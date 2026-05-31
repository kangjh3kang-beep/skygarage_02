import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import StarIcon from '@mui/icons-material/Star';
import { supabase } from '../../lib/supabase';

interface Mission {
  id: string;
  mission_key: string;
  title: string;
  description: string;
  target_count: number;
  current_count: number;
  completed: boolean;
  xp_reward: number;
}

interface StreakData {
  current_streak: number;
  longest_streak: number;
  total_xp: number;
  level: number;
}

const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1800, 2500, 3500, 5000];

function getLevelProgress(totalXp: number, level: number): number {
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 1000;
  const progress = ((totalXp - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
  return Math.min(Math.max(progress, 0), 100);
}

const DAILY_MISSIONS = [
  { key: 'check_dashboard', title: '대시보드 확인', description: '대시보드 방문하기', target: 1, xp: 5 },
  { key: 'review_alerts', title: '알림 확인', description: '시스템 알림 검토하기', target: 1, xp: 10 },
  { key: 'update_data', title: '데이터 갱신', description: '단지/사용자 데이터 업데이트', target: 1, xp: 15 },
  { key: 'resolve_ticket', title: '티켓 처리', description: '지원 티켓 1건 해결', target: 1, xp: 20 },
];

export default function EngagementWidget() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [streak, setStreak] = useState<StreakData>({ current_streak: 0, longest_streak: 0, total_xp: 0, level: 1 });
  const [expanded, setExpanded] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const initializeData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: streakData } = await supabase
      .from('admin_streaks')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (streakData) {
      setStreak(streakData);
      const today = new Date().toISOString().slice(0, 10);
      if (streakData.last_active_date !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const newStreak = streakData.last_active_date === yesterday ? streakData.current_streak + 1 : 1;
        const longest = Math.max(streakData.longest_streak, newStreak);
        await supabase.from('admin_streaks').update({
          current_streak: newStreak,
          longest_streak: longest,
          last_active_date: today,
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id);
        setStreak(prev => ({ ...prev, current_streak: newStreak, longest_streak: longest }));
      }
    } else {
      const today = new Date().toISOString().slice(0, 10);
      await supabase.from('admin_streaks').insert({
        user_id: user.id,
        current_streak: 1,
        longest_streak: 1,
        last_active_date: today,
        total_xp: 0,
        level: 1,
      });
      setStreak({ current_streak: 1, longest_streak: 1, total_xp: 0, level: 1 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: existingMissions } = await supabase
      .from('admin_missions')
      .select('*')
      .eq('user_id', user.id)
      .eq('mission_type', 'daily')
      .gte('created_at', todayStart.toISOString());

    if (existingMissions && existingMissions.length > 0) {
      setMissions(existingMissions);
    } else {
      const tomorrow = new Date(todayStart);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const newMissions = DAILY_MISSIONS.map(m => ({
        user_id: user.id,
        mission_type: 'daily',
        mission_key: m.key,
        title: m.title,
        description: m.description,
        target_count: m.target,
        current_count: 0,
        completed: false,
        xp_reward: m.xp,
        expires_at: tomorrow.toISOString(),
      }));
      const { data: inserted } = await supabase.from('admin_missions').insert(newMissions).select();
      if (inserted) setMissions(inserted);
    }
  }, []);

  useEffect(() => { initializeData(); }, [initializeData]);

  const completeMission = useCallback(async (mission: Mission) => {
    if (mission.completed || !userId) return;
    const newCount = mission.current_count + 1;
    const isComplete = newCount >= mission.target_count;

    await supabase.from('admin_missions').update({
      current_count: newCount,
      completed: isComplete,
      completed_at: isComplete ? new Date().toISOString() : null,
    }).eq('id', mission.id);

    if (isComplete) {
      const newXp = streak.total_xp + mission.xp_reward;
      const newLevel = LEVEL_THRESHOLDS.findIndex(t => t > newXp);
      const calculatedLevel = newLevel === -1 ? LEVEL_THRESHOLDS.length : newLevel;
      await supabase.from('admin_streaks').update({
        total_xp: newXp,
        level: calculatedLevel,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
      setStreak(prev => ({ ...prev, total_xp: newXp, level: calculatedLevel }));
    }

    setMissions(prev => prev.map(m => m.id === mission.id ? { ...m, current_count: newCount, completed: isComplete } : m));
  }, [userId, streak.total_xp]);

  const completedCount = missions.filter(m => m.completed).length;
  const totalMissions = missions.length;
  const levelProgress = getLevelProgress(streak.total_xp, streak.level);

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header with streak and level */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={`${streak.current_streak}일 연속 접속`}>
              <Chip
                icon={<LocalFireDepartmentIcon sx={{ fontSize: 14 }} />}
                label={`${streak.current_streak}일`}
                size="small"
                color={streak.current_streak >= 7 ? 'error' : streak.current_streak >= 3 ? 'warning' : 'default'}
                sx={{ height: 24, fontSize: '0.7rem', fontWeight: 700 }}
              />
            </Tooltip>
            <Tooltip title={`레벨 ${streak.level} - ${streak.total_xp} XP`}>
              <Chip
                icon={<StarIcon sx={{ fontSize: 14 }} />}
                label={`Lv.${streak.level}`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ height: 24, fontSize: '0.7rem', fontWeight: 700 }}
              />
            </Tooltip>
          </Box>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Box>

        {/* Level progress */}
        <Box sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Lv.{streak.level} 진행도</Typography>
            <Typography variant="caption" color="text.secondary">{streak.total_xp} XP</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={levelProgress}
            sx={{ height: 4, borderRadius: 2 }}
          />
        </Box>

        {/* Daily missions */}
        <Collapse in={expanded}>
          <Box sx={{ mt: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>오늘의 미션</Typography>
              <Typography variant="caption" color="text.secondary">{completedCount}/{totalMissions}</Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {missions.map(m => (
                <Box
                  key={m.id}
                  onClick={() => completeMission(m)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 0.75,
                    borderRadius: 1,
                    border: 1,
                    borderColor: m.completed ? 'success.main' : 'divider',
                    bgcolor: m.completed ? 'success.main' : 'transparent',
                    opacity: m.completed ? 0.6 : 1,
                    cursor: m.completed ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': m.completed ? {} : { borderColor: 'primary.main', bgcolor: 'action.hover' },
                  }}
                >
                  {m.completed ? (
                    <CheckCircleIcon sx={{ fontSize: 16, color: m.completed ? 'common.white' : 'success.main' }} />
                  ) : (
                    <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: m.completed ? 'common.white' : 'text.primary', display: 'block', lineHeight: 1.3 }}>
                      {m.title}
                    </Typography>
                  </Box>
                  <Chip
                    label={`+${m.xp_reward}`}
                    size="small"
                    sx={{ height: 18, fontSize: '0.6rem', minWidth: 32, bgcolor: m.completed ? 'rgba(255,255,255,0.3)' : 'action.hover' }}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

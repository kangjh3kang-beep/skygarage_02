import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import AccessibleIcon from '@mui/icons-material/Accessible';
import ElderlyIcon from '@mui/icons-material/Elderly';
import PregnantWomanIcon from '@mui/icons-material/PregnantWoman';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import HealingIcon from '@mui/icons-material/Healing';
import VerifiedIcon from '@mui/icons-material/Verified';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import TuneIcon from '@mui/icons-material/Tune';
import TimelineIcon from '@mui/icons-material/Timeline';
import PeopleIcon from '@mui/icons-material/People';
import SpeedIcon from '@mui/icons-material/Speed';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const CATEGORIES = [
  { value: 'elderly', label: '노약자', icon: <ElderlyIcon /> },
  { value: 'disabled', label: '장애인', icon: <AccessibleIcon /> },
  { value: 'pregnant', label: '임산부', icon: <PregnantWomanIcon /> },
  { value: 'child_companion', label: '영유아 동반', icon: <ChildCareIcon /> },
  { value: 'temporary_injury', label: '일시적 부상', icon: <HealingIcon /> },
] as const;

type Category = typeof CATEGORIES[number]['value'];

interface AccessibilityProfile {
  id: string;
  resident_id: string;
  category: Category;
  severity_level: number;
  wheelchair_required: boolean;
  assistance_required: boolean;
  car_seat_space: boolean;
  voice_command_enabled: boolean;
  companion_count: number;
  notes: string;
  verified: boolean;
  verified_at: string | null;
  valid_until: string | null;
  active: boolean;
  created_at: string;
  resident_accounts?: { name: string; unit_number: string; phone: string };
}

interface DispatchRule {
  id: string;
  complex_id: string;
  category: Category;
  priority_weight: number;
  max_wait_seconds: number;
  preferred_floor: number;
  preferred_zone: string;
  auto_assign_ground: boolean;
  escort_required: boolean;
  enabled: boolean;
  complexes?: { name: string };
}

interface DispatchLog {
  id: string;
  session_id: string;
  priority_score: number;
  original_queue_position: number;
  final_queue_position: number;
  wait_time_seconds: number;
  assigned_floor: number;
  assigned_slot: string;
  escort_dispatched: boolean;
  created_at: string;
}

function getCategoryInfo(category: string) {
  return CATEGORIES.find(c => c.value === category) || CATEGORIES[0];
}

function getCategoryColor(category: string): 'warning' | 'error' | 'secondary' | 'info' | 'default' {
  switch (category) {
    case 'elderly': return 'warning';
    case 'disabled': return 'error';
    case 'pregnant': return 'secondary';
    case 'child_companion': return 'info';
    case 'temporary_injury': return 'default';
    default: return 'default';
  }
}

export default function PriorityDispatch() {
  useDocumentTitle('교통약자 우선배차');
  const [tab, setTab] = useState(0);
  const [profiles, setProfiles] = useState<AccessibilityProfile[]>([]);
  const [rules, setRules] = useState<DispatchRule[]>([]);
  const [logs, setLogs] = useState<DispatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, verified: 0, categories: {} as Record<string, number> });
  const [ruleDialog, setRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<DispatchRule | null>(null);
  const [profileDialog, setProfileDialog] = useState(false);
  const [residents, setResidents] = useState<{ id: string; name: string; unit_number: string }[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [profilesRes, rulesRes, logsRes] = await Promise.all([
      supabase
        .from('resident_accessibility_profiles')
        .select('*, resident_accounts(name, unit_number, phone)')
        .order('created_at', { ascending: false }),
      supabase
        .from('priority_dispatch_rules')
        .select('*, complexes(name)')
        .order('priority_weight', { ascending: false }),
      supabase
        .from('priority_dispatch_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const profileData = (profilesRes.data || []) as AccessibilityProfile[];
    setProfiles(profileData);
    setRules((rulesRes.data || []) as DispatchRule[]);
    setLogs((logsRes.data || []) as DispatchLog[]);

    const catCounts: Record<string, number> = {};
    let verified = 0;
    profileData.forEach(p => {
      catCounts[p.category] = (catCounts[p.category] || 0) + 1;
      if (p.verified) verified++;
    });
    setStats({ total: profileData.length, verified, categories: catCounts });
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time subscription for live queue updates
  const [liveQueue, setLiveQueue] = useState<{ id: string; vehicle_number: string; priority_score: number; entry_at: string; status: string }[]>([]);

  useEffect(() => {
    const loadQueue = async () => {
      const { data } = await supabase
        .from('parking_sessions')
        .select('id, vehicle_number, priority_score, entry_at, status')
        .eq('is_priority_dispatch', true)
        .is('exit_at', null)
        .order('priority_score', { ascending: false });
      setLiveQueue(data || []);
    };
    loadQueue();

    const channel = supabase.channel('priority-queue-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_sessions', filter: 'is_priority_dispatch=eq.true' }, () => {
        loadQueue();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'priority_dispatch_log' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleToggleRule = async (rule: DispatchRule) => {
    await supabase
      .from('priority_dispatch_rules')
      .update({ enabled: !rule.enabled, updated_at: new Date().toISOString() })
      .eq('id', rule.id);
    fetchData();
  };

  const handleVerifyProfile = async (profile: AccessibilityProfile) => {
    await supabase
      .from('resident_accessibility_profiles')
      .update({ verified: !profile.verified, verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    fetchData();
  };

  const handleToggleProfileActive = async (profile: AccessibilityProfile) => {
    await supabase
      .from('resident_accessibility_profiles')
      .update({ active: !profile.active, updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    fetchData();
  };

  const handleSaveRule = async (ruleData: Partial<DispatchRule>) => {
    if (editingRule) {
      await supabase
        .from('priority_dispatch_rules')
        .update({ ...ruleData, updated_at: new Date().toISOString() })
        .eq('id', editingRule.id);
    } else {
      await supabase.from('priority_dispatch_rules').insert(ruleData);
    }
    setRuleDialog(false);
    setEditingRule(null);
    fetchData();
  };

  const openAddProfile = async () => {
    const { data } = await supabase
      .from('resident_accounts')
      .select('id, name, unit_number')
      .eq('status', 'active')
      .order('name');
    setResidents(data || []);
    setProfileDialog(true);
  };

  const handleSaveProfile = async (profileData: Partial<AccessibilityProfile>) => {
    await supabase.from('resident_accessibility_profiles').insert(profileData);
    setProfileDialog(false);
    fetchData();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>교통약자 우선배차</Typography>
          <Typography variant="body2" color="text.secondary">
            노약자, 장애인, 임산부 등 교통약자의 우선 배차 설정 관리
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<RefreshIcon />} onClick={fetchData} size="small">새로고침</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAddProfile} size="small">
            프로필 등록
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper sx={{ p: 2.5, textAlign: 'center' }}>
            <PeopleIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {loading ? <Skeleton width={60} sx={{ mx: 'auto' }} /> : stats.total}
            </Typography>
            <Typography variant="caption" color="text.secondary">등록된 교통약자</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper sx={{ p: 2.5, textAlign: 'center' }}>
            <VerifiedIcon sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {loading ? <Skeleton width={60} sx={{ mx: 'auto' }} /> : stats.verified}
            </Typography>
            <Typography variant="caption" color="text.secondary">인증 완료</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper sx={{ p: 2.5, textAlign: 'center' }}>
            <TuneIcon sx={{ fontSize: 32, color: 'warning.main', mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {loading ? <Skeleton width={60} sx={{ mx: 'auto' }} /> : rules.filter(r => r.enabled).length}
            </Typography>
            <Typography variant="caption" color="text.secondary">활성 배차 규칙</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper sx={{ p: 2.5, textAlign: 'center' }}>
            <SpeedIcon sx={{ fontSize: 32, color: 'info.main', mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {loading ? <Skeleton width={60} sx={{ mx: 'auto' }} /> : logs.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">배차 이력</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Category Breakdown */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>카테고리별 현황</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <Box key={cat.value} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                icon={cat.icon}
                label={`${cat.label}: ${stats.categories[cat.value] || 0}명`}
                color={getCategoryColor(cat.value)}
                size="small"
                variant="outlined"
              />
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Live Priority Queue */}
      {liveQueue.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, border: 2, borderColor: 'warning.main' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Chip label="LIVE" size="small" color="error" sx={{ animation: 'pulse 2s infinite', '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } } }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>실시간 우선배차 대기열</Typography>
            <Typography variant="caption" color="text.secondary">({liveQueue.length}건 대기중)</Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>순위</TableCell>
                  <TableCell>차량번호</TableCell>
                  <TableCell>우선점수</TableCell>
                  <TableCell>대기시간</TableCell>
                  <TableCell>상태</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {liveQueue.map((item, idx) => {
                  const waitSec = Math.floor((Date.now() - new Date(item.entry_at).getTime()) / 1000);
                  const waitMin = Math.floor(waitSec / 60);
                  return (
                    <TableRow key={item.id} sx={idx === 0 ? { bgcolor: 'rgba(237, 108, 2, 0.08)' } : undefined}>
                      <TableCell>
                        <Chip label={`#${idx + 1}`} size="small" color={idx === 0 ? 'warning' : 'default'} sx={{ height: 22, fontWeight: 700 }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.vehicle_number}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={item.priority_score} size="small" color="warning" sx={{ height: 22 }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={waitMin > 2 ? 'error.main' : 'text.primary'}>
                          {waitMin > 0 ? `${waitMin}분 ${waitSec % 60}초` : `${waitSec}초`}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={item.status === 'retrieving' ? '출차중' : '입차중'} size="small" color={item.status === 'retrieving' ? 'success' : 'info'} variant="outlined" sx={{ height: 22 }} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab icon={<PeopleIcon />} iconPosition="start" label="교통약자 프로필" />
          <Tab icon={<TuneIcon />} iconPosition="start" label="배차 규칙" />
          <Tab icon={<TimelineIcon />} iconPosition="start" label="배차 이력" />
        </Tabs>

        {/* Profiles Tab */}
        {tab === 0 && (
          <Box sx={{ p: 2 }}>
            {loading ? (
              <Box sx={{ p: 3 }}><LinearProgress /></Box>
            ) : profiles.length === 0 ? (
              <Alert severity="info">등록된 교통약자 프로필이 없습니다.</Alert>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>사용자</TableCell>
                      <TableCell>카테고리</TableCell>
                      <TableCell>심각도</TableCell>
                      <TableCell>보조 요구사항</TableCell>
                      <TableCell>인증</TableCell>
                      <TableCell>상태</TableCell>
                      <TableCell align="right">관리</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {profiles.map(profile => {
                      const catInfo = getCategoryInfo(profile.category);
                      return (
                        <TableRow key={profile.id} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {profile.resident_accounts?.name || '-'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {profile.resident_accounts?.unit_number || ''}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={catInfo.icon}
                              label={catInfo.label}
                              size="small"
                              color={getCategoryColor(profile.category)}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <LinearProgress
                                variant="determinate"
                                value={profile.severity_level * 20}
                                sx={{ width: 60, height: 6, borderRadius: 3 }}
                                color={profile.severity_level >= 4 ? 'error' : profile.severity_level >= 3 ? 'warning' : 'info'}
                              />
                              <Typography variant="caption">{profile.severity_level}/5</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {profile.wheelchair_required && <Chip label="휠체어" size="small" color="error" variant="filled" sx={{ height: 20, fontSize: '0.65rem' }} />}
                              {profile.assistance_required && <Chip label="보조" size="small" color="warning" variant="filled" sx={{ height: 20, fontSize: '0.65rem' }} />}
                              {profile.car_seat_space && <Chip label="카시트" size="small" color="info" variant="filled" sx={{ height: 20, fontSize: '0.65rem' }} />}
                              {profile.voice_command_enabled && <Chip label="음성" size="small" variant="filled" sx={{ height: 20, fontSize: '0.65rem' }} />}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Tooltip title={profile.verified ? `인증일: ${profile.verified_at?.slice(0, 10)}` : '미인증'}>
                              <Chip
                                icon={<VerifiedIcon />}
                                label={profile.verified ? '인증됨' : '미인증'}
                                size="small"
                                color={profile.verified ? 'success' : 'default'}
                                variant={profile.verified ? 'filled' : 'outlined'}
                                sx={{ height: 24 }}
                              />
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={profile.active}
                              onChange={() => handleToggleProfileActive(profile)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="인증 토글">
                              <IconButton size="small" onClick={() => handleVerifyProfile(profile)}>
                                <VerifiedIcon fontSize="small" color={profile.verified ? 'success' : 'disabled'} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* Rules Tab */}
        {tab === 1 && (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => { setEditingRule(null); setRuleDialog(true); }}
              >
                규칙 추가
              </Button>
            </Box>
            {loading ? (
              <LinearProgress />
            ) : rules.length === 0 ? (
              <Alert severity="info">등록된 배차 규칙이 없습니다.</Alert>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>단지</TableCell>
                      <TableCell>카테고리</TableCell>
                      <TableCell>우선순위 가중치</TableCell>
                      <TableCell>최대 대기(초)</TableCell>
                      <TableCell>선호 층</TableCell>
                      <TableCell>지상 자동배정</TableCell>
                      <TableCell>에스코트</TableCell>
                      <TableCell>활성</TableCell>
                      <TableCell align="right">관리</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rules.map(rule => {
                      const catInfo = getCategoryInfo(rule.category);
                      return (
                        <TableRow key={rule.id} hover sx={{ opacity: rule.enabled ? 1 : 0.5 }}>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{rule.complexes?.name || '-'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip icon={catInfo.icon} label={catInfo.label} size="small" color={getCategoryColor(rule.category)} variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              x{rule.priority_weight}
                            </Typography>
                          </TableCell>
                          <TableCell>{rule.max_wait_seconds}s</TableCell>
                          <TableCell>{rule.preferred_floor === 0 ? '지상(G)' : `B${Math.abs(rule.preferred_floor)}`}</TableCell>
                          <TableCell>
                            <Chip label={rule.auto_assign_ground ? 'ON' : 'OFF'} size="small" color={rule.auto_assign_ground ? 'success' : 'default'} sx={{ height: 20 }} />
                          </TableCell>
                          <TableCell>
                            <Chip label={rule.escort_required ? '필수' : '불필요'} size="small" color={rule.escort_required ? 'warning' : 'default'} sx={{ height: 20 }} />
                          </TableCell>
                          <TableCell>
                            <Switch checked={rule.enabled} onChange={() => handleToggleRule(rule)} size="small" />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small" onClick={() => { setEditingRule(rule); setRuleDialog(true); }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* Logs Tab */}
        {tab === 2 && (
          <Box sx={{ p: 2 }}>
            {loading ? (
              <LinearProgress />
            ) : logs.length === 0 ? (
              <Alert severity="info">배차 이력이 없습니다.</Alert>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>일시</TableCell>
                      <TableCell>우선점수</TableCell>
                      <TableCell>대기열 변경</TableCell>
                      <TableCell>대기 시간</TableCell>
                      <TableCell>배정 위치</TableCell>
                      <TableCell>에스코트</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {logs.map(log => (
                      <TableRow key={log.id} hover>
                        <TableCell>
                          <Typography variant="caption">
                            {new Date(log.created_at).toLocaleString('ko-KR')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={log.priority_score} size="small" color="primary" sx={{ height: 22, fontWeight: 700 }} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            #{log.original_queue_position} → #{log.final_queue_position}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color={log.wait_time_seconds > 120 ? 'error.main' : 'text.primary'}>
                            {log.wait_time_seconds}s
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {log.assigned_floor === 0 ? 'G' : `B${Math.abs(log.assigned_floor)}`}층 / {log.assigned_slot}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={log.escort_dispatched ? '배차됨' : '-'}
                            size="small"
                            color={log.escort_dispatched ? 'success' : 'default'}
                            variant={log.escort_dispatched ? 'filled' : 'outlined'}
                            sx={{ height: 20 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </Paper>

      {/* Rule Edit Dialog */}
      <RuleDialog
        open={ruleDialog}
        rule={editingRule}
        onClose={() => { setRuleDialog(false); setEditingRule(null); }}
        onSave={handleSaveRule}
      />

      {/* Profile Add Dialog */}
      <ProfileDialog
        open={profileDialog}
        residents={residents}
        onClose={() => setProfileDialog(false)}
        onSave={handleSaveProfile}
      />
    </Box>
  );
}

function RuleDialog({ open, rule, onClose, onSave }: {
  open: boolean;
  rule: DispatchRule | null;
  onClose: () => void;
  onSave: (data: Partial<DispatchRule>) => void;
}) {
  const [category, setCategory] = useState<Category>('elderly');
  const [weight, setWeight] = useState(10);
  const [maxWait, setMaxWait] = useState(120);
  const [floor, setFloor] = useState(0);
  const [autoGround, setAutoGround] = useState(true);
  const [escort, setEscort] = useState(false);
  const [complexId, setComplexId] = useState('');
  const [complexes, setComplexes] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (open) {
      supabase.from('complexes').select('id, name').eq('status', 'active').then(({ data }) => {
        setComplexes(data || []);
        if (!rule && data && data.length > 0) setComplexId(data[0].id);
      });
      if (rule) {
        setCategory(rule.category);
        setWeight(rule.priority_weight);
        setMaxWait(rule.max_wait_seconds);
        setFloor(rule.preferred_floor);
        setAutoGround(rule.auto_assign_ground);
        setEscort(rule.escort_required);
        setComplexId(rule.complex_id);
      } else {
        setCategory('elderly');
        setWeight(10);
        setMaxWait(120);
        setFloor(0);
        setAutoGround(true);
        setEscort(false);
      }
    }
  }, [open, rule]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{rule ? '배차 규칙 수정' : '배차 규칙 추가'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <TextField
          select label="단지" value={complexId}
          onChange={e => setComplexId(e.target.value)} fullWidth size="small"
        >
          {complexes.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
        </TextField>
        <TextField
          select label="카테고리" value={category}
          onChange={e => setCategory(e.target.value as Category)} fullWidth size="small"
        >
          {CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
        </TextField>
        <TextField
          type="number" label="우선순위 가중치" value={weight}
          onChange={e => setWeight(Number(e.target.value))} fullWidth size="small"
          helperText="높을수록 우선 배차 (1-20)"
          slotProps={{ htmlInput: { min: 1, max: 20 } }}
        />
        <TextField
          type="number" label="최대 대기시간 (초)" value={maxWait}
          onChange={e => setMaxWait(Number(e.target.value))} fullWidth size="small"
          helperText="초과시 에스컬레이션"
          slotProps={{ htmlInput: { min: 30, max: 600 } }}
        />
        <TextField
          type="number" label="선호 층" value={floor}
          onChange={e => setFloor(Number(e.target.value))} fullWidth size="small"
          helperText="0 = 지상, 음수 = 지하"
          slotProps={{ htmlInput: { min: -5, max: 5 } }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2">지상층 자동 배정</Typography>
          <Switch checked={autoGround} onChange={e => setAutoGround(e.target.checked)} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2">에스코트 필수</Typography>
          <Switch checked={escort} onChange={e => setEscort(e.target.checked)} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button
          variant="contained"
          onClick={() => onSave({
            complex_id: complexId,
            category,
            priority_weight: weight,
            max_wait_seconds: maxWait,
            preferred_floor: floor,
            auto_assign_ground: autoGround,
            escort_required: escort,
            enabled: true,
          })}
        >
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ProfileDialog({ open, residents, onClose, onSave }: {
  open: boolean;
  residents: { id: string; name: string; unit_number: string }[];
  onClose: () => void;
  onSave: (data: Partial<AccessibilityProfile>) => void;
}) {
  const [residentId, setResidentId] = useState('');
  const [category, setCategory] = useState<Category>('elderly');
  const [severity, setSeverity] = useState(1);
  const [wheelchair, setWheelchair] = useState(false);
  const [assistance, setAssistance] = useState(false);
  const [carSeat, setCarSeat] = useState(false);
  const [voice, setVoice] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open && residents.length > 0) {
      setResidentId(residents[0].id);
      setCategory('elderly');
      setSeverity(1);
      setWheelchair(false);
      setAssistance(false);
      setCarSeat(false);
      setVoice(false);
      setNotes('');
    }
  }, [open, residents]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>교통약자 프로필 등록</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <TextField
          select label="사용자" value={residentId}
          onChange={e => setResidentId(e.target.value)} fullWidth size="small"
        >
          {residents.map(r => (
            <MenuItem key={r.id} value={r.id}>{r.name} ({r.unit_number})</MenuItem>
          ))}
        </TextField>
        <TextField
          select label="카테고리" value={category}
          onChange={e => setCategory(e.target.value as Category)} fullWidth size="small"
        >
          {CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
        </TextField>
        <TextField
          type="number" label="심각도 (1-5)" value={severity}
          onChange={e => setSeverity(Number(e.target.value))} fullWidth size="small"
          slotProps={{ htmlInput: { min: 1, max: 5 } }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2">휠체어 필요</Typography>
          <Switch checked={wheelchair} onChange={e => setWheelchair(e.target.checked)} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2">보조 인력 필요</Typography>
          <Switch checked={assistance} onChange={e => setAssistance(e.target.checked)} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2">카시트/유모차 공간</Typography>
          <Switch checked={carSeat} onChange={e => setCarSeat(e.target.checked)} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2">음성 명령 사용</Typography>
          <Switch checked={voice} onChange={e => setVoice(e.target.checked)} />
        </Box>
        <TextField
          label="비고" value={notes} multiline rows={2}
          onChange={e => setNotes(e.target.value)} fullWidth size="small"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button
          variant="contained"
          disabled={!residentId}
          onClick={() => onSave({
            resident_id: residentId,
            category,
            severity_level: severity,
            wheelchair_required: wheelchair,
            assistance_required: assistance,
            car_seat_space: carSeat,
            voice_command_enabled: voice,
            notes,
            active: true,
          })}
        >
          등록
        </Button>
      </DialogActions>
    </Dialog>
  );
}

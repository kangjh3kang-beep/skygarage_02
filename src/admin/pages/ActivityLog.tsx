import { useState, useEffect, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Avatar from '@mui/material/Avatar';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import TimelineIcon from '@mui/icons-material/Timeline';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LoginIcon from '@mui/icons-material/Login';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

interface ActivityEntry {
  id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { color: 'success' | 'primary' | 'error' | 'warning' | 'info' | 'default'; icon: React.ReactNode; label: string }> = {
  CREATE: { color: 'success', icon: <AddCircleIcon fontSize="small" />, label: '생성' },
  UPDATE: { color: 'primary', icon: <EditIcon fontSize="small" />, label: '수정' },
  DELETE: { color: 'error', icon: <DeleteIcon fontSize="small" />, label: '삭제' },
  LOGIN: { color: 'warning', icon: <LoginIcon fontSize="small" />, label: '로그인' },
  VIEW: { color: 'info', icon: <VisibilityIcon fontSize="small" />, label: '조회' },
  EXPORT: { color: 'default', icon: <DownloadIcon fontSize="small" />, label: '내보내기' },
};

const TABLE_LABELS: Record<string, string> = {
  complexes: '단지',
  resident_accounts: '사용자',
  parking_sessions: '주차',
  maintenance_logs: '정비',
  contracts: '계약',
  system_alerts: '알림',
  security_audit_logs: '감사',
  support_tickets: '티켓',
  team_members: '팀원',
  admin_settings: '설정',
  site_images: '이미지',
  section_media: '미디어',
  crm_leads: 'CRM',
  billing_invoices: '청구',
};

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR');
}

function groupByDate(entries: ActivityEntry[]): Map<string, ActivityEntry[]> {
  const groups = new Map<string, ActivityEntry[]>();
  for (const entry of entries) {
    const date = new Date(entry.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    const existing = groups.get(date) || [];
    existing.push(entry);
    groups.set(date, existing);
  }
  return groups;
}

export default function ActivityLog() {
  useDocumentTitle('활동 로그');
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [tableFilter, setTableFilter] = useState('all');
  const [limit, setLimit] = useState(100);

  const loadData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('security_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (actionFilter !== 'all') query = query.eq('action', actionFilter);
    if (tableFilter !== 'all') query = query.eq('table_name', tableFilter);

    const { data } = await query;
    if (data) setEntries(data);
    setLoading(false);
  }, [actionFilter, tableFilter, limit]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('activity-log-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'security_audit_logs' }, (payload) => {
        setEntries(prev => [payload.new as ActivityEntry, ...prev].slice(0, limit));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [limit]);

  const filtered = useMemo(() => {
    if (!search) return entries;
    const lower = search.toLowerCase();
    return entries.filter(e =>
      e.table_name?.toLowerCase().includes(lower) ||
      e.action?.toLowerCase().includes(lower) ||
      e.record_id?.toLowerCase().includes(lower) ||
      JSON.stringify(e.details)?.toLowerCase().includes(lower)
    );
  }, [entries, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  const actions = useMemo(() => [...new Set(entries.map(e => e.action).filter(Boolean))], [entries]);
  const tables = useMemo(() => [...new Set(entries.map(e => e.table_name).filter(Boolean))], [entries]);

  const todayCount = entries.filter(e => new Date(e.created_at).toDateString() === new Date().toDateString()).length;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <TimelineIcon sx={{ color: 'primary.main', fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>활동 로그</Typography>
            <Chip label={`오늘 ${todayCount}건`} size="small" color="primary" variant="outlined" />
          </Box>
          <Typography variant="body2" color="text.secondary">
            관리자 활동 타임라인 - 실시간 추적
          </Typography>
        </Box>
        <Tooltip title="새로고침">
          <IconButton onClick={loadData} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          sx={{ minWidth: 220 }}
        />
        <TextField select size="small" value={actionFilter} onChange={e => setActionFilter(e.target.value)} sx={{ minWidth: 120 }}>
          <MenuItem value="all">전체 액션</MenuItem>
          {actions.map(a => <MenuItem key={a} value={a}>{ACTION_CONFIG[a]?.label || a}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={tableFilter} onChange={e => setTableFilter(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="all">전체 대상</MenuItem>
          {tables.map(t => <MenuItem key={t} value={t}>{TABLE_LABELS[t] || t}</MenuItem>)}
        </TextField>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={56} />
          ))}
        </Box>
      ) : (
        <Box sx={{ position: 'relative', pl: { xs: 2, sm: 4 } }}>
          <Box
            sx={{
              position: 'absolute',
              left: { xs: 10, sm: 18 },
              top: 0,
              bottom: 0,
              width: 2,
              bgcolor: 'divider',
              borderRadius: 1,
            }}
          />

          {Array.from(grouped.entries()).map(([date, items]) => (
            <Box key={date} sx={{ mb: 3 }}>
              <Box sx={{ position: 'relative', mb: 1.5, ml: -0.5 }}>
                <Chip
                  label={date}
                  size="small"
                  variant="filled"
                  sx={{ fontSize: '0.7rem', fontWeight: 600, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}
                />
              </Box>

              {items.map((entry) => {
                const config = ACTION_CONFIG[entry.action] || { color: 'default' as const, icon: <VisibilityIcon fontSize="small" />, label: entry.action };
                return (
                  <Box
                    key={entry.id}
                    sx={{
                      position: 'relative',
                      mb: 1,
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        left: { xs: -14, sm: -22 },
                        top: 16,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: `${config.color}.main`,
                        border: 2,
                        borderColor: 'background.paper',
                      },
                    }}
                  >
                    <Card
                      variant="outlined"
                      sx={{
                        transition: 'box-shadow 0.15s, border-color 0.15s',
                        '&:hover': { borderColor: 'primary.main', boxShadow: 1 },
                      }}
                    >
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 }, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: `${config.color}.main`,
                            color: `${config.color}.contrastText`,
                          }}
                        >
                          {config.icon}
                        </Avatar>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Chip label={config.label} size="small" color={config.color} sx={{ height: 20, fontSize: '0.65rem' }} />
                            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8125rem' }}>
                              {TABLE_LABELS[entry.table_name] || entry.table_name}
                            </Typography>
                            {entry.record_id && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                #{entry.record_id.substring(0, 8)}
                              </Typography>
                            )}
                          </Box>
                          {entry.details && Object.keys(entry.details).length > 0 && (
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 400 }}>
                              {Object.entries(entry.details).map(([k, v]) => `${k}: ${v}`).join(', ')}
                            </Typography>
                          )}
                        </Box>

                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                            {formatTimeAgo(entry.created_at)}
                          </Typography>
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.625rem', display: 'block' }}>
                            {new Date(entry.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Box>
                );
              })}
            </Box>
          ))}

          {filtered.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body2" color="text.secondary">활동 기록이 없습니다</Typography>
            </Box>
          )}

          {filtered.length >= limit && (
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button variant="outlined" size="small" onClick={() => setLimit(prev => prev + 100)}>
                더 보기
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

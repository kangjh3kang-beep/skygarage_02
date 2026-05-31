import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import ApartmentIcon from '@mui/icons-material/Apartment';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';

interface SystemAlert {
  id: string;
  severity: string;
  title: string;
  message: string;
  source: string;
  status: string;
  created_at: string;
  resolved_at: string;
  complex_id?: string;
}

interface EventLog {
  id: string;
  event_type: string;
  source: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
  complex_id?: string;
}

interface Complex {
  id: string;
  name: string;
  address?: string;
  region?: string;
}

const severityIcons: Record<string, React.ReactNode> = {
  critical: <ErrorIcon color="error" fontSize="small" />,
  warning: <WarningIcon color="warning" fontSize="small" />,
  info: <InfoIcon color="info" fontSize="small" />,
};
const severityColors: Record<string, 'error' | 'warning' | 'info' | 'default'> = { critical: 'error', warning: 'warning', info: 'info' };

export default function GlobalNOC() {
  useDocumentTitle('Global NOC');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [tab, setTab] = useState(0);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [complexFilter, setComplexFilter] = useState('all');
  const [aiRecs, setAiRecs] = useState<{ id: string; title: string; priority: string; type: string }[]>([]);
  const [detailAlert, setDetailAlert] = useState<SystemAlert | null>(null);
  const [detailEvent, setDetailEvent] = useState<EventLog | null>(null);

  const complexName = (id?: string) => {
    if (!id) return '-';
    return complexes.find(c => c.id === id)?.name || '알 수 없음';
  };

  const complexAddress = (id?: string) => {
    if (!id) return '';
    return complexes.find(c => c.id === id)?.address || '';
  };

  const loadComplexes = useCallback(async () => {
    const { data } = await supabase.from('complexes').select('id, name, address, region');
    if (data) setComplexes(data);
  }, []);

  const loadAlerts = useCallback(async () => {
    let query = supabase.from('system_alerts').select('*').order('created_at', { ascending: false }).limit(100);
    if (severityFilter !== 'all') query = query.eq('severity', severityFilter);
    if (complexFilter !== 'all') query = query.eq('complex_id', complexFilter);
    const { data } = await query;
    if (data) setAlerts(data);
  }, [severityFilter, complexFilter]);

  const loadEvents = useCallback(async () => {
    let query = supabase.from('event_log').select('*').order('created_at', { ascending: false }).limit(200);
    if (complexFilter !== 'all') query = query.eq('complex_id', complexFilter);
    const { data } = await query;
    if (data) setEvents(data);
  }, [complexFilter]);

  const loadAiRecs = useCallback(async () => {
    const { data } = await supabase.from('ai_recommendations')
      .select('id, title, priority, type')
      .in('status', ['pending', 'acknowledged'])
      .in('type', ['system', 'data_quality', 'anomaly'])
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setAiRecs(data);
  }, []);

  const loadData = useCallback(async () => {
    await Promise.all([loadComplexes(), loadAlerts(), loadEvents(), loadAiRecs()]);
    setLoading(false);
  }, [loadComplexes, loadAlerts, loadEvents, loadAiRecs]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const ch1 = supabase.channel('noc-alerts-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_alerts' }, () => { loadAlerts(); })
      .subscribe();
    const ch2 = supabase.channel('noc-events-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_log' }, () => { loadEvents(); })
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [loadAlerts, loadEvents]);

  const handleAcknowledge = useCallback(async (alert: SystemAlert) => {
    const { error } = await supabase.from('system_alerts').update({ status: 'acknowledged' }).eq('id', alert.id);
    if (error) { showToast('처리 실패', 'error'); return; }
    logAction('UPDATE', 'system_alerts', alert.id, { action: 'acknowledge' });
    showToast('확인 처리 완료', 'success');
    loadAlerts();
    setDetailAlert(null);
  }, [showToast, logAction, loadAlerts]);

  const criticalCount = alerts.filter(a => a.severity === 'critical' && a.status !== 'resolved').length;
  const activeCount = alerts.filter(a => a.status !== 'resolved').length;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h1">Global NOC</Typography>
          <Typography variant="body2" color="text.secondary">전체 단지/건물의 시스템 상태를 실시간 모니터링합니다</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/observability')}>관측성</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/maintenance')}>정비</Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card sx={{ borderLeft: 3, borderColor: 'error.main' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">Critical</Typography>
              <Typography variant="h2" color="error">{criticalCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">Active</Typography>
              <Typography variant="h2">{activeCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">Events (24h)</Typography>
              <Typography variant="h2">{events.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">Complexes</Typography>
              <Typography variant="h2">{complexes.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* AI Recommendations */}
      {aiRecs.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">AI 분석 권장사항</Typography>
              <Button variant="text" size="small" onClick={() => navigate('/admin/ai-management')}>전체 보기</Button>
            </Box>
            <List disablePadding dense>
              {aiRecs.map(rec => (
                <ListItemButton key={rec.id} onClick={() => navigate('/admin/ai-management')} sx={{ borderRadius: 1, py: 0.5 }}>
                  <ListItemText primary={rec.title} slotProps={{ primary: { sx: { fontSize: '0.8rem', fontWeight: 500 } } }} />
                  <Chip label={rec.priority} size="small" color={rec.priority === 'high' ? 'error' : rec.priority === 'medium' ? 'warning' : 'default'} variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                </ListItemButton>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Tabs + Filters */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={`Alerts (${alerts.length})`} />
          <Tab label={`Events (${events.length})`} />
        </Tabs>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            select
            size="small"
            label="단지"
            value={complexFilter}
            onChange={e => setComplexFilter(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="all">전체 단지</MenuItem>
            {complexes.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          {tab === 0 && (
            <TextField select size="small" label="심각도" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} sx={{ minWidth: 120 }}>
              <MenuItem value="all">전체</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
              <MenuItem value="warning">Warning</MenuItem>
              <MenuItem value="info">Info</MenuItem>
            </TextField>
          )}
        </Box>
      </Box>

      {/* Alerts Table */}
      {tab === 0 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>심각도</TableCell>
                  <TableCell>단지/건물</TableCell>
                  <TableCell>제목</TableCell>
                  <TableCell>출처</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell>시간</TableCell>
                  <TableCell align="center">조치</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {alerts.map(a => (
                  <TableRow
                    key={a.id}
                    hover
                    onClick={() => setDetailAlert(a)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: a.severity === 'critical' && a.status !== 'resolved' ? 'rgba(239,68,68,0.04)' : undefined,
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {severityIcons[a.severity]}
                        <Chip label={a.severity} size="small" color={severityColors[a.severity] || 'default'} sx={{ height: 20, fontSize: '0.65rem' }} />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <ApartmentIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {complexName(a.complex_id)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.title}</Typography>
                    </TableCell>
                    <TableCell><Typography variant="caption">{a.source}</Typography></TableCell>
                    <TableCell><Chip label={a.status} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} /></TableCell>
                    <TableCell><Typography variant="caption">{a.created_at ? new Date(a.created_at).toLocaleString('ko-KR') : '-'}</Typography></TableCell>
                    <TableCell align="center" onClick={e => e.stopPropagation()}>
                      {a.status !== 'resolved' && a.status !== 'acknowledged' && (
                        <Chip label="확인" size="small" color="primary" onClick={() => handleAcknowledge(a)} sx={{ cursor: 'pointer', height: 22 }} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {alerts.length === 0 && (
                  <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}><Typography variant="body2" color="text.secondary">알림이 없습니다</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Events Table */}
      {tab === 1 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>유형</TableCell>
                  <TableCell>단지/건물</TableCell>
                  <TableCell>출처</TableCell>
                  <TableCell>메시지</TableCell>
                  <TableCell>시간</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map(e => (
                  <TableRow
                    key={e.id}
                    hover
                    onClick={() => setDetailEvent(e)}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <TableCell><Chip label={e.event_type} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} /></TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <ApartmentIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>{complexName(e.complex_id)}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="caption">{e.source}</Typography></TableCell>
                    <TableCell><Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.message}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{e.created_at ? new Date(e.created_at).toLocaleString('ko-KR') : '-'}</Typography></TableCell>
                  </TableRow>
                ))}
                {events.length === 0 && (
                  <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}><Typography variant="body2" color="text.secondary">이벤트가 없습니다</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Alert Detail Dialog */}
      <Dialog
        open={!!detailAlert}
        onClose={() => setDetailAlert(null)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        {detailAlert && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {severityIcons[detailAlert.severity]}
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>알림 상세</Typography>
              </Box>
              <IconButton size="small" onClick={() => setDetailAlert(null)}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 2.5 }}>
                <Chip label={detailAlert.severity} size="small" color={severityColors[detailAlert.severity] || 'default'} sx={{ mr: 1 }} />
                <Chip label={detailAlert.status} size="small" variant="outlined" />
              </Box>

              <Typography variant="h3" sx={{ mb: 1 }}>{detailAlert.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>{detailAlert.message}</Typography>

              <Divider sx={{ my: 2 }} />

              {/* Location Context */}
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>소속 단지/건물</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                  <ApartmentIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{complexName(detailAlert.complex_id)}</Typography>
                    {complexAddress(detailAlert.complex_id) && (
                      <Typography variant="caption" color="text.secondary">{complexAddress(detailAlert.complex_id)}</Typography>
                    )}
                  </Box>
                  {detailAlert.complex_id && (
                    <IconButton size="small" onClick={() => navigate('/admin/complexes')} sx={{ ml: 'auto' }}>
                      <OpenInNewIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  )}
                </Box>
              </Box>

              {/* Details Grid */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>출처</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{detailAlert.source}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>발생 시간</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{detailAlert.created_at ? new Date(detailAlert.created_at).toLocaleString('ko-KR') : '-'}</Typography>
                </Grid>
                {detailAlert.resolved_at && (
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>해결 시간</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{new Date(detailAlert.resolved_at).toLocaleString('ko-KR')}</Typography>
                  </Grid>
                )}
              </Grid>

              {/* Actions */}
              {detailAlert.status !== 'resolved' && detailAlert.status !== 'acknowledged' && (
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button variant="contained" size="small" onClick={() => handleAcknowledge(detailAlert)}>확인 처리</Button>
                  {detailAlert.complex_id && (
                    <Button variant="outlined" size="small" onClick={() => navigate('/admin/maintenance')}>정비 요청</Button>
                  )}
                </Box>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* Event Detail Dialog */}
      <Dialog
        open={!!detailEvent}
        onClose={() => setDetailEvent(null)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        {detailEvent && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>이벤트 상세</Typography>
              <IconButton size="small" onClick={() => setDetailEvent(null)}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 2 }}>
                <Chip label={detailEvent.event_type} size="small" variant="outlined" />
              </Box>

              <Typography variant="body1" sx={{ mb: 2 }}>{detailEvent.message}</Typography>

              <Divider sx={{ my: 2 }} />

              {/* Location Context */}
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>소속 단지/건물</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                  <ApartmentIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{complexName(detailEvent.complex_id)}</Typography>
                    {complexAddress(detailEvent.complex_id) && (
                      <Typography variant="caption" color="text.secondary">{complexAddress(detailEvent.complex_id)}</Typography>
                    )}
                  </Box>
                </Box>
              </Box>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>출처</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{detailEvent.source}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>발생 시간</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{detailEvent.created_at ? new Date(detailEvent.created_at).toLocaleString('ko-KR') : '-'}</Typography>
                </Grid>
              </Grid>

              {/* Metadata */}
              {detailEvent.metadata && Object.keys(detailEvent.metadata).length > 0 && (
                <Box sx={{ mt: 2.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>상세 데이터</Typography>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover', fontFamily: 'monospace', fontSize: '0.75rem', maxHeight: 200, overflow: 'auto' }}>
                    {Object.entries(detailEvent.metadata).map(([key, val]) => (
                      <Box key={key} sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 100 }}>{key}:</Typography>
                        <Typography variant="caption" color="text.secondary">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}

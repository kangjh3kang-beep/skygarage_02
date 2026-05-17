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
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
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
}

interface EventLog {
  id: string;
  event_type: string;
  source: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const severityIcons: Record<string, React.ReactNode> = { critical: <ErrorIcon color="error" fontSize="small" />, warning: <WarningIcon color="warning" fontSize="small" />, info: <InfoIcon color="info" fontSize="small" /> };
const severityColors: Record<string, 'error' | 'warning' | 'info' | 'default'> = { critical: 'error', warning: 'warning', info: 'info' };

export default function GlobalNOC() {
  useDocumentTitle('Global NOC');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [tab, setTab] = useState(0);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [aiRecs, setAiRecs] = useState<{ id: string; title: string; priority: string; type: string }[]>([]);

  const loadAlerts = useCallback(async () => {
    let query = supabase.from('system_alerts').select('*').order('created_at', { ascending: false }).limit(100);
    if (severityFilter !== 'all') query = query.eq('severity', severityFilter);
    const { data } = await query;
    if (data) setAlerts(data);
  }, [severityFilter]);

  const loadEvents = useCallback(async () => {
    const { data } = await supabase.from('event_log').select('*').order('created_at', { ascending: false }).limit(200);
    if (data) setEvents(data);
  }, []);

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
    await Promise.all([loadAlerts(), loadEvents(), loadAiRecs()]);
    setLoading(false);
  }, [loadAlerts, loadEvents, loadAiRecs]);

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
  }, [showToast, logAction, loadAlerts]);

  const criticalCount = alerts.filter(a => a.severity === 'critical' && a.status !== 'resolved').length;
  const activeCount = alerts.filter(a => a.status !== 'resolved').length;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">Global NOC</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/ai-management')}>AI 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/workflows')}>워크플로우</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/alerts')}>알림 센터</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/observability')}>관측성</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/maintenance')}>정비 관리</Button>
        </Box>
      </Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}><Card sx={{ borderLeft: 3, borderColor: 'error.main' }}><CardContent sx={{ textAlign: 'center' }}><Typography variant="caption" color="text.secondary">Critical</Typography><Typography variant="h2" color="error">{criticalCount}</Typography></CardContent></Card></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Card><CardContent sx={{ textAlign: 'center' }}><Typography variant="caption" color="text.secondary">Active Alerts</Typography><Typography variant="h2">{activeCount}</Typography></CardContent></Card></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Card><CardContent sx={{ textAlign: 'center' }}><Typography variant="caption" color="text.secondary">Total Events</Typography><Typography variant="h2">{events.length}</Typography></CardContent></Card></Grid>
      </Grid>

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

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={`Alerts (${alerts.length})`} />
          <Tab label={`Event Log (${events.length})`} />
        </Tabs>
        {tab === 0 && (
          <TextField select size="small" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} sx={{ width: 160 }}>
            <MenuItem value="all">All</MenuItem><MenuItem value="critical">Critical</MenuItem><MenuItem value="warning">Warning</MenuItem><MenuItem value="info">Info</MenuItem>
          </TextField>
        )}
      </Box>

      {tab === 0 ? (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Severity</TableCell><TableCell>Title</TableCell><TableCell>Source</TableCell>
                <TableCell>Status</TableCell><TableCell>Time</TableCell><TableCell align="center">Action</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {alerts.map(a => (
                  <TableRow key={a.id} hover sx={{ bgcolor: a.severity === 'critical' && a.status !== 'resolved' ? 'error.50' : undefined }}>
                    <TableCell>{severityIcons[a.severity] || a.severity} <Chip label={a.severity} size="small" color={severityColors[a.severity] || 'default'} sx={{ ml: 0.5 }} /></TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{a.title}</Typography><Typography variant="caption" color="text.secondary">{a.message}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{a.source}</Typography></TableCell>
                    <TableCell><Chip label={a.status} size="small" variant="outlined" /></TableCell>
                    <TableCell><Typography variant="caption">{a.created_at ? new Date(a.created_at).toLocaleString('ko-KR') : '-'}</Typography></TableCell>
                    <TableCell align="center">
                      {a.status !== 'resolved' && a.status !== 'acknowledged' && <Chip label="Acknowledge" size="small" color="primary" onClick={() => handleAcknowledge(a)} sx={{ cursor: 'pointer' }} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      ) : (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Type</TableCell><TableCell>Source</TableCell><TableCell>Message</TableCell><TableCell>Time</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {events.map(e => (
                  <TableRow key={e.id} hover>
                    <TableCell><Chip label={e.event_type} size="small" variant="outlined" /></TableCell>
                    <TableCell><Typography variant="caption">{e.source}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{e.message}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{e.created_at ? new Date(e.created_at).toLocaleString('ko-KR') : '-'}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </Box>
  );
}

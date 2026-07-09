import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
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
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ElevatorIcon from '@mui/icons-material/Elevator';
import RouterIcon from '@mui/icons-material/Router';
import SyncIcon from '@mui/icons-material/Sync';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SendIcon from '@mui/icons-material/Send';
import SettingsInputAntennaIcon from '@mui/icons-material/SettingsInputAntenna';
import SpeedIcon from '@mui/icons-material/Speed';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import TerminalIcon from '@mui/icons-material/Terminal';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArticleIcon from '@mui/icons-material/Article';
import { supabase } from '../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuditLog } from '../../hooks/useAuditLog';

interface HardwareAdapter {
  id: string;
  vendor_name: string;
  device_type: string;
  protocol_type: string;
  api_endpoint: string;
  api_version: string;
  auth_method: string;
  heartbeat_interval_sec: number;
  timeout_ms: number;
  retry_policy: { max_retries: number; backoff_type: string; base_delay_ms: number };
  capability_map: { commands?: string[]; telemetry?: string[]; features?: string[] };
  status: string;
  last_connected_at: string | null;
  created_at: string;
}

interface DeviceInstance {
  id: string;
  adapter_id: string;
  complex_id: string;
  atr_unit_id: string | null;
  elevator_id: string | null;
  device_serial: string;
  device_model: string;
  firmware_version: string;
  installation_floor: number;
  installation_zone: string;
  network_address: string;
  connection_status: string;
  last_heartbeat_at: string | null;
  metadata: Record<string, unknown>;
  commissioned_at: string | null;
  created_at: string;
  hardware_adapters?: { vendor_name: string; device_type: string; protocol_type: string };
  complexes?: { name: string };
}

interface HealthEvent {
  id: string;
  device_id: string;
  event_type: string;
  severity: string;
  title: string;
  description: string;
  diagnostic_data: Record<string, unknown>;
  resolution_status: string;
  created_at: string;
}

interface Command {
  id: string;
  device_id: string;
  command_type: string;
  priority: number;
  payload: Record<string, unknown>;
  status: string;
  correlation_id: string;
  sent_at: string | null;
  ack_at: string | null;
  completed_at: string | null;
  error_code: string;
  error_message: string;
  retry_count: number;
  created_at: string;
}

const statusColors: Record<string, 'success' | 'error' | 'warning' | 'default' | 'info'> = {
  online: 'success',
  active: 'success',
  offline: 'error',
  inactive: 'error',
  degraded: 'warning',
  testing: 'info',
  maintenance: 'default',
  deprecated: 'default',
};

const severityColors: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'info',
  info: 'default',
};

const commandStatusColors: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  queued: 'default',
  sent: 'info',
  acknowledged: 'info',
  executing: 'warning',
  completed: 'success',
  failed: 'error',
  timeout: 'error',
  cancelled: 'default',
};

function formatDate(d: string | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function timeSince(d: string | null): string {
  if (!d) return '-';
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}초 전`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  return `${Math.floor(diff / 86400000)}일 전`;
}

export default function HardwareIntegration() {
  useDocumentTitle('하드웨어 통합');
  const { logAction } = useAuditLog();
  const [tab, setTab] = useState(0);
  const [adapters, setAdapters] = useState<HardwareAdapter[]>([]);
  const [devices, setDevices] = useState<DeviceInstance[]>([]);
  const [healthEvents, setHealthEvents] = useState<HealthEvent[]>([]);
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);
  const [adapterDialog, setAdapterDialog] = useState(false);
  const [commandDialog, setCommandDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInstance | null>(null);
  const [deviceDetailOpen, setDeviceDetailOpen] = useState(false);
  const [commandForm, setCommandForm] = useState({ device_id: '', command_type: 'diagnostics', priority: 3, payload: '{}' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [adaptRes, devRes, healthRes, cmdRes] = await Promise.all([
      supabase.from('hardware_adapters').select('*').order('created_at', { ascending: false }),
      supabase.from('hardware_device_registry').select('*, hardware_adapters(vendor_name, device_type, protocol_type), complexes(name)').order('created_at', { ascending: false }),
      supabase.from('hardware_health_events').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('hardware_commands').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (adaptRes.data) setAdapters(adaptRes.data);
    if (devRes.data) setDevices(devRes.data);
    if (healthRes.data) setHealthEvents(healthRes.data);
    if (cmdRes.data) setCommands(cmdRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const ch = supabase
      .channel('hardware_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hardware_device_instances' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hardware_health_events' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  const onlineCount = devices.filter(d => d.connection_status === 'online').length;
  const degradedCount = devices.filter(d => d.connection_status === 'degraded').length;
  const offlineCount = devices.filter(d => d.connection_status === 'offline').length;
  const openAlerts = healthEvents.filter(e => e.resolution_status !== 'resolved').length;

  const handleDispatchCommand = async () => {
    const payload = JSON.parse(commandForm.payload || '{}');
    const { error } = await supabase.from('hardware_commands').insert({
      device_id: commandForm.device_id,
      command_type: commandForm.command_type,
      priority: commandForm.priority,
      payload,
      status: 'queued',
    });
    if (!error) {
      logAction('CREATE', 'hardware_commands', undefined, { device_id: commandForm.device_id, command_type: commandForm.command_type });
      setCommandDialog(false);
      setCommandForm({ device_id: '', command_type: 'diagnostics', priority: 3, payload: '{}' });
      fetchData();
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={60} sx={{ mb: 2, borderRadius: 1 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map(i => (
            <Grid size={{ xs: 6, md: 3 }} key={i}>
              <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
            하드웨어 연동 관리
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            협력업체 ATR 로봇 및 차량 엘리베이터 시스템 통합 운영
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={fetchData}>
            새로고침
          </Button>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setAdapterDialog(true)}>
            어댑터 추가
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <RouterIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">등록 장비</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{devices.length}</Typography>
              <Typography variant="caption" color="text.secondary">
                ATR {devices.filter(d => d.hardware_adapters?.device_type === 'atr_robot').length} / EV {devices.filter(d => d.hardware_adapters?.device_type === 'vehicle_elevator').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'success.main', borderWidth: 1 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                <Typography variant="caption" color="text.secondary">온라인</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>{onlineCount}</Typography>
              <Typography variant="caption" color="text.secondary">정상 연결</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: degradedCount > 0 ? 'warning.main' : 'divider' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <WarningIcon sx={{ fontSize: 18, color: degradedCount > 0 ? 'warning.main' : 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">성능저하/오프라인</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: degradedCount > 0 ? 'warning.main' : 'text.primary' }}>
                {degradedCount + offlineCount}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                주의 {degradedCount} / 끊김 {offlineCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: openAlerts > 0 ? 'error.main' : 'divider' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <ErrorIcon sx={{ fontSize: 18, color: openAlerts > 0 ? 'error.main' : 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">미해결 알림</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: openAlerts > 0 ? 'error.main' : 'text.primary' }}>{openAlerts}</Typography>
              <Typography variant="caption" color="text.secondary">조치 필요</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<SettingsInputAntennaIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="어댑터 설정" sx={{ minHeight: 44, fontSize: '0.8rem' }} />
          <Tab icon={<RouterIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="장비 레지스트리" sx={{ minHeight: 44, fontSize: '0.8rem' }} />
          <Tab icon={<HealthAndSafetyIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="상태 모니터링" sx={{ minHeight: 44, fontSize: '0.8rem' }} />
          <Tab icon={<TerminalIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="명령 콘솔" sx={{ minHeight: 44, fontSize: '0.8rem' }} />
          <Tab icon={<ArticleIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="협력업체 요구사항" sx={{ minHeight: 44, fontSize: '0.8rem' }} />
        </Tabs>
      </Box>

      {/* Tab 0: Adapter Configuration */}
      {tab === 0 && (
        <TableContainer component={Card} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>협력업체</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>장비 유형</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>프로토콜</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>엔드포인트</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>인증</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Heartbeat</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>상태</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>마지막 연결</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {adapters.map(a => (
                <TableRow key={a.id} hover sx={{ cursor: 'pointer' }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {a.device_type === 'atr_robot' ? <SmartToyIcon sx={{ fontSize: 16, color: 'info.main' }} /> : <ElevatorIcon sx={{ fontSize: 16, color: 'warning.main' }} />}
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.vendor_name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={a.device_type === 'atr_robot' ? 'ATR 로봇' : '차량EV'} size="small" variant="outlined"
                      color={a.device_type === 'atr_robot' ? 'info' : 'warning'} sx={{ fontSize: '0.65rem', height: 20 }} />
                  </TableCell>
                  <TableCell>
                    <Chip label={a.protocol_type.toUpperCase()} size="small" sx={{ fontSize: '0.65rem', height: 20 }} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
                      {a.api_endpoint.length > 40 ? a.api_endpoint.slice(0, 40) + '...' : a.api_endpoint}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={a.auth_method} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{a.heartbeat_interval_sec}s</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={a.status} size="small" color={statusColors[a.status] || 'default'} sx={{ fontSize: '0.65rem', height: 20 }} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">{timeSince(a.last_connected_at)}</Typography>
                  </TableCell>
                </TableRow>
              ))}
              {adapters.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">등록된 어댑터가 없습니다</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Tab 1: Device Registry */}
      {tab === 1 && (
        <TableContainer component={Card} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>장비 시리얼</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>유형</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>모델</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>단지</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>펌웨어</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>네트워크</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>연결 상태</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>최근 신호</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {devices.map(d => (
                <TableRow key={d.id} hover sx={{ cursor: 'pointer' }} onClick={() => { setSelectedDevice(d); setDeviceDetailOpen(true); }}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {d.device_serial || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {d.hardware_adapters?.device_type === 'atr_robot'
                        ? <SmartToyIcon sx={{ fontSize: 14, color: 'info.main' }} />
                        : <ElevatorIcon sx={{ fontSize: 14, color: 'warning.main' }} />}
                      <Typography variant="caption">
                        {d.hardware_adapters?.device_type === 'atr_robot' ? 'ATR' : 'EV'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell><Typography variant="caption">{d.device_model || '-'}</Typography></TableCell>
                  <TableCell><Typography variant="caption">{d.complexes?.name || '-'}</Typography></TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>{d.firmware_version || '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>{d.network_address || '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={d.connection_status} size="small" color={statusColors[d.connection_status] || 'default'} sx={{ fontSize: '0.65rem', height: 20 }} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">{timeSince(d.last_heartbeat_at)}</Typography>
                  </TableCell>
                </TableRow>
              ))}
              {devices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">등록된 장비가 없습니다</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Tab 2: Health Monitoring */}
      {tab === 2 && (
        <Box>
          {healthEvents.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>현재 발생한 이벤트가 없습니다. 장비 상태가 정상입니다.</Alert>
          ) : null}
          <TableContainer component={Card} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>심각도</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>유형</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>제목</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>설명</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>해결 상태</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>발생 시간</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {healthEvents.map(e => (
                  <TableRow key={e.id} hover>
                    <TableCell>
                      <Chip label={e.severity} size="small" color={severityColors[e.severity] || 'default'} sx={{ fontSize: '0.65rem', height: 20 }} />
                    </TableCell>
                    <TableCell><Typography variant="caption">{e.event_type}</Typography></TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{e.title}</Typography></TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">{e.description.slice(0, 50)}</Typography></TableCell>
                    <TableCell>
                      <Chip
                        label={e.resolution_status === 'resolved' ? '해결' : e.resolution_status === 'investigating' ? '조사중' : '미해결'}
                        size="small"
                        color={e.resolution_status === 'resolved' ? 'success' : e.resolution_status === 'investigating' ? 'warning' : 'error'}
                        variant="outlined"
                        sx={{ fontSize: '0.65rem', height: 20 }}
                      />
                    </TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">{formatDate(e.created_at)}</Typography></TableCell>
                  </TableRow>
                ))}
                {healthEvents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                      <CheckCircleIcon sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">모든 장비 정상 가동 중</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Tab 3: Command Console */}
      {tab === 3 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" size="small" startIcon={<SendIcon />} onClick={() => setCommandDialog(true)}>
              명령 전송
            </Button>
          </Box>
          <TableContainer component={Card} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>명령</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>우선순위</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>상태</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>전송</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>응답</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>완료</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>재시도</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>에러</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {commands.map(c => (
                  <TableRow key={c.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        {c.command_type}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={c.priority === 1 ? 'Critical' : c.priority === 2 ? 'High' : c.priority === 3 ? 'Normal' : 'Low'}
                        size="small"
                        color={c.priority <= 1 ? 'error' : c.priority === 2 ? 'warning' : 'default'}
                        sx={{ fontSize: '0.6rem', height: 18 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={c.status} size="small" color={commandStatusColors[c.status] || 'default'} sx={{ fontSize: '0.65rem', height: 20 }} />
                    </TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">{formatDate(c.sent_at)}</Typography></TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">{formatDate(c.ack_at)}</Typography></TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">{formatDate(c.completed_at)}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{c.retry_count}</Typography></TableCell>
                    <TableCell>
                      {c.error_code && (
                        <Tooltip title={c.error_message || c.error_code}>
                          <Typography variant="caption" color="error.main" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
                            {c.error_code}
                          </Typography>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {commands.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary">발행된 명령이 없습니다</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Tab 4: 협력업체 요구사항 가이드 - Vendor Integration Requirements */}
      {tab === 4 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* 개요 */}
          <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
            아래는 SkyGarage Palatria 플랫폼과 연동하기 위해 협력업체(ATR 로봇, 차량 엘리베이터)로부터 제공받아야 하는 항목 목록입니다.
            연동 계약 체결 시 아래 체크리스트를 기준으로 기술 협의를 진행합니다.
          </Alert>

          {/* Section 1: ATR 자율주행주차로봇 */}
          <Card sx={{ border: '1px solid', borderColor: 'info.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SmartToyIcon color="info" />
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                  ATR 자율주행주차로봇 - 협력업체 제공 항목
                </Typography>
              </Box>

              {/* 1-1: API/프로토콜 */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'info.main' }}>
                1. 통신 인터페이스 (API/Protocol Specification)
              </Typography>
              <Box component="ul" sx={{ pl: 3, mb: 2, '& li': { fontSize: '0.8rem', mb: 0.5, color: 'text.secondary' } }}>
                <li><strong>API 문서</strong> - REST API 또는 gRPC 서비스 정의서 (OpenAPI 3.0 / Proto 파일)</li>
                <li><strong>인증 방식</strong> - API Key, OAuth2 Client Credentials, mTLS 인증서 중 택 1</li>
                <li><strong>엔드포인트 URL</strong> - 운영/테스트 환경 각각의 Base URL</li>
                <li><strong>MQTT 토픽 구조</strong> - MQTT 사용 시 토픽 네이밍 규칙 및 QoS 레벨</li>
                <li><strong>메시지 포맷</strong> - JSON Schema 또는 Protobuf 정의</li>
                <li><strong>Rate Limit</strong> - 초당 최대 요청 수, 동시 연결 제한</li>
                <li><strong>Webhook 콜백 URL 등록</strong> - 당사 Gateway URL을 콜백으로 등록 가능 여부</li>
              </Box>

              {/* 1-2: 명령 체계 */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'info.main' }}>
                2. 명령 체계 (Command Interface)
              </Typography>
              <Box component="ul" sx={{ pl: 3, mb: 2, '& li': { fontSize: '0.8rem', mb: 0.5, color: 'text.secondary' } }}>
                <li><strong>move_vehicle</strong> - 차량 이송 명령 (출발 스팟 → 도착 스팟, 차량 크기/무게 파라미터)</li>
                <li><strong>dock_charge</strong> - 로봇 충전 도킹 (자동 복귀 충전 트리거)</li>
                <li><strong>emergency_stop</strong> - 비상 정지 (즉시 정지, 0.5초 이내 응답 보장 필요)</li>
                <li><strong>resume</strong> - 비상 해제 후 재개</li>
                <li><strong>diagnostics</strong> - 자가진단 실행 및 결과 반환</li>
                <li><strong>명령 ACK 프로토콜</strong> - queued→sent→acknowledged→executing→completed 상태 전이 콜백</li>
                <li><strong>에러 코드 체계</strong> - 에러 코드표 (코드, 설명, 복구 가능 여부, 권장 조치)</li>
              </Box>

              {/* 1-3: 텔레메트리 */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'info.main' }}>
                3. 텔레메트리 데이터 (Telemetry Feed)
              </Typography>
              <Box component="ul" sx={{ pl: 3, mb: 2, '& li': { fontSize: '0.8rem', mb: 0.5, color: 'text.secondary' } }}>
                <li><strong>위치 (position)</strong> - X, Y 좌표 또는 스팟 ID, 현재 층 (최소 1초 간격)</li>
                <li><strong>속도 (speed)</strong> - 이동 속도 m/s</li>
                <li><strong>배터리 (battery)</strong> - 잔량 %, 충전 상태, 예상 잔여시간</li>
                <li><strong>온도 (temperature)</strong> - 모터/배터리 온도 (과열 임계값 포함)</li>
                <li><strong>진동 (vibration)</strong> - 진동 센서 값 (베어링 마모 감지용)</li>
                <li><strong>하중 (load)</strong> - 현재 적재 무게 kg</li>
                <li><strong>장애물 감지</strong> - LiDAR/카메라 기반 장애물 이벤트</li>
                <li><strong>Heartbeat</strong> - 10초 이내 주기적 생존 신호</li>
              </Box>

              {/* 1-4: 하드웨어 사양 */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'info.main' }}>
                4. 하드웨어 사양서
              </Typography>
              <Box component="ul" sx={{ pl: 3, mb: 2, '& li': { fontSize: '0.8rem', mb: 0.5, color: 'text.secondary' } }}>
                <li><strong>모델명/시리얼 체계</strong> - 시리얼 넘버 규칙 (자산 추적용)</li>
                <li><strong>최대 적재 중량</strong> - kg 단위 (차량 크기별 대응 가능 범위)</li>
                <li><strong>이동 속도</strong> - 공차/적재 시 최대 속도</li>
                <li><strong>리프트 높이</strong> - 차량 리프팅 최대 높이</li>
                <li><strong>배터리 용량/충전 시간</strong> - 완충 시간, 연속 운행 가능 시간</li>
                <li><strong>운행 가능 경사도</strong> - 최대 경사 각도</li>
                <li><strong>회전 반경</strong> - 최소 회전 반경 (통로 폭 설계에 필요)</li>
                <li><strong>펌웨어 업데이트 방식</strong> - OTA 지원 여부, 업데이트 절차</li>
                <li><strong>네트워크 인터페이스</strong> - WiFi/5G/LAN, IP 할당 방식</li>
              </Box>

              {/* 1-5: 안전 */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'info.main' }}>
                5. 안전 및 인증
              </Typography>
              <Box component="ul" sx={{ pl: 3, '& li': { fontSize: '0.8rem', mb: 0.5, color: 'text.secondary' } }}>
                <li><strong>안전 인증서</strong> - CE, KC, ISO 13849 (기능 안전) 등</li>
                <li><strong>비상정지 메커니즘</strong> - 물리 버튼 + 소프트웨어 E-Stop 이중화</li>
                <li><strong>장애물 감지 사양</strong> - LiDAR 범위, 정지 거리, 반응 시간</li>
                <li><strong>화재 방지</strong> - 배터리 과열 보호, 화재 감지 센서</li>
                <li><strong>소음 기준</strong> - 야간 운행 시 소음 레벨 dB(A)</li>
              </Box>
            </CardContent>
          </Card>

          {/* Section 2: 차량 엘리베이터 */}
          <Card sx={{ border: '1px solid', borderColor: 'warning.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ElevatorIcon color="warning" />
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                  차량 엘리베이터 - 협력업체 제공 항목
                </Typography>
              </Box>

              {/* 2-1: API/프로토콜 */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'warning.main' }}>
                1. 통신 인터페이스 (API/Protocol Specification)
              </Typography>
              <Box component="ul" sx={{ pl: 3, mb: 2, '& li': { fontSize: '0.8rem', mb: 0.5, color: 'text.secondary' } }}>
                <li><strong>제어 API</strong> - REST API, Modbus TCP, OPC-UA 중 지원 프로토콜 명시</li>
                <li><strong>SDK/라이브러리</strong> - 제조사 제공 SDK (있을 경우)</li>
                <li><strong>인증 방식</strong> - 로컬 네트워크 mTLS 또는 API Key</li>
                <li><strong>실시간 상태 스트림</strong> - WebSocket/MQTT 기반 상태 Push 지원 여부</li>
                <li><strong>제어 권한 레벨</strong> - 읽기 전용 / 호출 제어 / 완전 제어 (수동 운행 포함)</li>
              </Box>

              {/* 2-2: 명령 체계 */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'warning.main' }}>
                2. 명령 체계 (Command Interface)
              </Typography>
              <Box component="ul" sx={{ pl: 3, mb: 2, '& li': { fontSize: '0.8rem', mb: 0.5, color: 'text.secondary' } }}>
                <li><strong>call_elevator</strong> - 특정 층 호출 (목적층, 문 방향, 우선순위)</li>
                <li><strong>open_gate</strong> - 차량 진입/진출 게이트 개방 (개방 유지 시간 설정)</li>
                <li><strong>emergency_stop</strong> - 긴급 정지 (1초 이내 응답 보장)</li>
                <li><strong>floor_lock/unlock</strong> - 특정 층 접근 제한/해제</li>
                <li><strong>운행 모드 전환</strong> - 자동/수동/정비 모드 전환 API</li>
                <li><strong>문 제어</strong> - 강제 개방/폐쇄, 개방 유지 타이머</li>
                <li><strong>에러 코드 체계</strong> - 에러 코드표 및 자동 복구 가능 여부</li>
              </Box>

              {/* 2-3: 텔레메트리 */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'warning.main' }}>
                3. 텔레메트리 데이터 (Telemetry Feed)
              </Typography>
              <Box component="ul" sx={{ pl: 3, mb: 2, '& li': { fontSize: '0.8rem', mb: 0.5, color: 'text.secondary' } }}>
                <li><strong>현재 층 (position)</strong> - 실시간 층 위치 및 이동 방향</li>
                <li><strong>하중 (load)</strong> - 현재 적재 중량 kg (차량 무게 감지)</li>
                <li><strong>문 상태 (door_status)</strong> - open/closing/closed/opening</li>
                <li><strong>모터 전류 (motor_current)</strong> - 구동 모터 전류값 A</li>
                <li><strong>속도 (speed)</strong> - 승강 속도 m/s</li>
                <li><strong>온도 (temperature)</strong> - 기계실/권상기 온도</li>
                <li><strong>운행 횟수 (trip_count)</strong> - 누적 운행 횟수</li>
                <li><strong>Heartbeat</strong> - 15초 이내 주기적 생존 신호</li>
              </Box>

              {/* 2-4: 하드웨어 사양 */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'warning.main' }}>
                4. 하드웨어 사양서
              </Typography>
              <Box component="ul" sx={{ pl: 3, mb: 2, '& li': { fontSize: '0.8rem', mb: 0.5, color: 'text.secondary' } }}>
                <li><strong>최대 적재 중량</strong> - 차량 + 로봇 합산 중량 지원 (최소 5,000kg)</li>
                <li><strong>카 사이즈</strong> - 폭 x 깊이 x 높이 (SUV 급 차량 수용 필수)</li>
                <li><strong>운행 층수</strong> - 최저층 ~ 최고층 범위</li>
                <li><strong>승강 속도</strong> - m/s (차량 탑재 시 속도 제한 포함)</li>
                <li><strong>문 크기/개방 시간</strong> - 차량 진입 가능 폭, 완전 개방 소요 시간</li>
                <li><strong>바닥 내하중</strong> - 카 바닥 단위면적당 하중 (kgf/m2)</li>
                <li><strong>정전 시 동작</strong> - UPS 여부, 최근층 자동 이동 기능</li>
                <li><strong>유지보수 주기</strong> - 정기점검 간격, 부품 수명 정보</li>
              </Box>

              {/* 2-5: 안전 */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'warning.main' }}>
                5. 안전 및 인증
              </Typography>
              <Box component="ul" sx={{ pl: 3, '& li': { fontSize: '0.8rem', mb: 0.5, color: 'text.secondary' } }}>
                <li><strong>승강기 검사 인증</strong> - 한국승강기안전공단 검사 합격증</li>
                <li><strong>차량 감지 센서</strong> - 카 내 차량/사람 감지 (광전 센서, 레이더)</li>
                <li><strong>과적 보호</strong> - 하중 초과 시 자동 정지 및 알림</li>
                <li><strong>화재 시 동작</strong> - 화재 모드 (지정층 이동 후 문 개방)</li>
                <li><strong>지진 감지</strong> - 지진 감지기 연동 자동 정지</li>
                <li><strong>비상 탈출</strong> - 차량 내 인명 감지 시 비상 프로토콜</li>
              </Box>
            </CardContent>
          </Card>

          {/* Section 3: 공통 요구사항 */}
          <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', mb: 2 }}>
                공통 요구사항 (양사 모두)
              </Typography>

              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>기술 문서</Typography>
                  <Box component="ul" sx={{ pl: 3, '& li': { fontSize: '0.8rem', mb: 0.5, color: 'text.secondary' } }}>
                    <li>API 명세서 (OpenAPI 3.0 또는 AsyncAPI)</li>
                    <li>장비 설치/설정 매뉴얼</li>
                    <li>에러 코드 참조표 (코드, 설명, 복구 절차)</li>
                    <li>네트워크 요구사항 (포트, 대역폭, 지연 허용치)</li>
                    <li>보안 가이드 (인증서 교체 주기, 키 로테이션)</li>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>운영 지원</Typography>
                  <Box component="ul" sx={{ pl: 3, '& li': { fontSize: '0.8rem', mb: 0.5, color: 'text.secondary' } }}>
                    <li>테스트 환경 (Sandbox/Staging) 제공</li>
                    <li>시뮬레이터 또는 에뮬레이터 제공</li>
                    <li>기술 지원 연락처 (24/7 긴급, 업무시간 일반)</li>
                    <li>SLA 정의 (응답시간, 가용률, 복구시간 목표)</li>
                    <li>펌웨어 업데이트 릴리스 노트 사전 공유</li>
                    <li>현장 설치 엔지니어 파견 일정</li>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>연동 계약 조건</Typography>
                  <Box component="ul" sx={{ pl: 3, '& li': { fontSize: '0.8rem', mb: 0.5, color: 'text.secondary' } }}>
                    <li>API 호출 과금 체계 (있을 경우)</li>
                    <li>데이터 소유권 및 처리 범위 합의</li>
                    <li>장애 시 책임 범위 (하드웨어 vs 소프트웨어)</li>
                    <li>유지보수 비용 분담 구조</li>
                    <li>계약 기간 및 갱신 조건</li>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>당사(SkyGarage) 제공 항목</Typography>
                  <Box component="ul" sx={{ pl: 3, '& li': { fontSize: '0.8rem', mb: 0.5, color: 'text.secondary' } }}>
                    <li>Hardware Gateway Webhook URL (텔레메트리/이벤트 수신)</li>
                    <li>Command Dispatch API 문서</li>
                    <li>디바이스 등록/인증 절차 안내</li>
                    <li>테스트 도구 (시뮬레이터, API 테스터)</li>
                    <li>모니터링 대시보드 접근 권한</li>
                    <li>장애 에스컬레이션 프로세스</li>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Section 4: 연동 워크플로 */}
          <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', mb: 2 }}>
                연동 프로세스 (Integration Workflow)
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {[
                  { step: '1', title: '기술 협의', desc: 'API 문서 교환, 프로토콜 합의, 보안 인증 방식 확정' },
                  { step: '2', title: '어댑터 개발', desc: '당사 Gateway에 협력업체 프로토콜 어댑터 구현' },
                  { step: '3', title: 'Sandbox 테스트', desc: '협력업체 테스트 환경에서 시뮬레이터를 이용한 통합 테스트' },
                  { step: '4', title: '현장 설치', desc: '실제 단지에 장비 설치, 네트워크 연결, 디바이스 등록' },
                  { step: '5', title: '연동 검증', desc: '실 장비 명령/텔레메트리 테스트, 비상 정지 테스트, 부하 테스트' },
                  { step: '6', title: '상용 전환', desc: '모니터링 활성화, SLA 적용, 24/7 운영 전환' },
                ].map(item => (
                  <Box key={item.step} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700 }}>{item.step}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.title}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.desc}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Device Detail Dialog */}
      <Dialog open={deviceDetailOpen} onClose={() => setDeviceDetailOpen(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { borderRadius: 2 } } }}>
        {selectedDevice && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {selectedDevice.hardware_adapters?.device_type === 'atr_robot'
                  ? <SmartToyIcon color="info" />
                  : <ElevatorIcon color="warning" />}
                <Typography variant="h6" sx={{ fontWeight: 700 }}>장비 상세</Typography>
              </Box>
              <IconButton size="small" onClick={() => setDeviceDetailOpen(false)}><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2, mb: 2 }}>
                <Typography variant="caption" color="text.secondary">소속 단지</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedDevice.complexes?.name || '-'}</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">시리얼</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedDevice.device_serial}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">모델</Typography>
                  <Typography variant="body2">{selectedDevice.device_model || '-'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">펌웨어</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{selectedDevice.firmware_version || '-'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">네트워크 주소</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{selectedDevice.network_address || '-'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">설치 층</Typography>
                  <Typography variant="body2">{selectedDevice.installation_floor}F</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">설치 구역</Typography>
                  <Typography variant="body2">{selectedDevice.installation_zone || '-'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">프로토콜</Typography>
                  <Typography variant="body2">{selectedDevice.hardware_adapters?.protocol_type?.toUpperCase()}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">최근 하트비트</Typography>
                  <Typography variant="body2">{timeSince(selectedDevice.last_heartbeat_at)}</Typography>
                </Grid>
              </Grid>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" startIcon={<SpeedIcon />}>진단 실행</Button>
                <Button size="small" variant="outlined" startIcon={<SyncIcon />}>펌웨어 확인</Button>
                <Button size="small" variant="outlined" color="error" startIcon={<WarningIcon />}>비상정지</Button>
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* Adapter Add Dialog */}
      <Dialog open={adapterDialog} onClose={() => setAdapterDialog(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { borderRadius: 2 } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>새 어댑터 등록</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
            협력업체의 장비 연동을 위한 프로토콜 어댑터를 등록합니다.
          </Alert>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth size="small" label="업체명" placeholder="예: RoboParking Co." />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth size="small" select label="장비 유형" defaultValue="atr_robot">
                <MenuItem value="atr_robot">ATR 자율주행로봇</MenuItem>
                <MenuItem value="vehicle_elevator">차량 엘리베이터</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth size="small" select label="프로토콜" defaultValue="rest_api">
                <MenuItem value="rest_api">REST API</MenuItem>
                <MenuItem value="mqtt">MQTT</MenuItem>
                <MenuItem value="grpc">gRPC</MenuItem>
                <MenuItem value="modbus_tcp">Modbus TCP</MenuItem>
                <MenuItem value="opc_ua">OPC-UA</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth size="small" label="API 엔드포인트" placeholder="https://api.vendor.example/v1" />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth size="small" select label="인증 방식" defaultValue="api_key">
                <MenuItem value="api_key">API Key</MenuItem>
                <MenuItem value="oauth2">OAuth2</MenuItem>
                <MenuItem value="mtls">mTLS</MenuItem>
                <MenuItem value="hmac">HMAC</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 3 }}>
              <TextField fullWidth size="small" label="Heartbeat(초)" type="number" defaultValue={30} />
            </Grid>
            <Grid size={{ xs: 3 }}>
              <TextField fullWidth size="small" label="Timeout(ms)" type="number" defaultValue={5000} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAdapterDialog(false)} color="inherit">취소</Button>
          <Button variant="contained" onClick={() => setAdapterDialog(false)}>등록</Button>
        </DialogActions>
      </Dialog>

      {/* Command Dispatch Dialog */}
      <Dialog open={commandDialog} onClose={() => setCommandDialog(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { borderRadius: 2 } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>명령 전송</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth size="small" select label="대상 장비"
                value={commandForm.device_id}
                onChange={e => setCommandForm(f => ({ ...f, device_id: e.target.value }))}
              >
                {devices.map(d => (
                  <MenuItem key={d.id} value={d.id}>
                    [{d.hardware_adapters?.device_type === 'atr_robot' ? 'ATR' : 'EV'}] {d.device_serial} - {d.complexes?.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth size="small" select label="명령 유형"
                value={commandForm.command_type}
                onChange={e => setCommandForm(f => ({ ...f, command_type: e.target.value }))}
              >
                <MenuItem value="move_vehicle">차량 이동</MenuItem>
                <MenuItem value="call_elevator">엘리베이터 호출</MenuItem>
                <MenuItem value="open_gate">게이트 개방</MenuItem>
                <MenuItem value="dock_charge">충전 도킹</MenuItem>
                <MenuItem value="emergency_stop">비상 정지</MenuItem>
                <MenuItem value="resume">재개</MenuItem>
                <MenuItem value="diagnostics">진단</MenuItem>
                <MenuItem value="firmware_update">펌웨어 업데이트</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth size="small" select label="우선순위"
                value={commandForm.priority}
                onChange={e => setCommandForm(f => ({ ...f, priority: Number(e.target.value) }))}
              >
                <MenuItem value={1}>Critical (1)</MenuItem>
                <MenuItem value={2}>High (2)</MenuItem>
                <MenuItem value={3}>Normal (3)</MenuItem>
                <MenuItem value={4}>Low (4)</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth size="small" multiline rows={3} label="페이로드 (JSON)"
                value={commandForm.payload}
                onChange={e => setCommandForm(f => ({ ...f, payload: e.target.value }))}
                sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.8rem' } }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCommandDialog(false)} color="inherit">취소</Button>
          <Button variant="contained" startIcon={<SendIcon />} onClick={handleDispatchCommand} disabled={!commandForm.device_id}>
            전송
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

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
import { supabase } from '../lib/supabase';

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

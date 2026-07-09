import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MapIcon from '@mui/icons-material/Map';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import ElevatorIcon from '@mui/icons-material/Elevator';
import EventNoteIcon from '@mui/icons-material/EventNote';
import BuildIcon from '@mui/icons-material/Build';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import { useTheme } from '@mui/material/styles';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useNavigate } from 'react-router-dom';

interface Zone {
  id: string;
  name: string;
  code: string;
  region_id: string;
  status: string;
}

interface ComplexDetail {
  id: string;
  name: string;
  status: string;
  total_parking_slots: number;
  total_units: number;
  atrCount: number;
  elevatorCount: number;
  maintenanceCount: number;
  zone_id: string | null;
}

const EMPTY_ZONE = { name: '', code: '', status: 'active' };

export default function ZoneConsole() {
  useDocumentTitle('T2 Zone Console');
  const navigate = useNavigate();
  const theme = useTheme();
  const { logAction } = useAuditLog();
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [complexes, setComplexes] = useState<ComplexDetail[]>([]);
  const [unassignedComplexes, setUnassignedComplexes] = useState<ComplexDetail[]>([]);
  const [workflowStats, setWorkflowStats] = useState({ running: 0, pending: 0, completed: 0 });
  const [zoneDialog, setZoneDialog] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneForm, setZoneForm] = useState(EMPTY_ZONE);
  const [assignDialog, setAssignDialog] = useState(false);

  const fetchZones = useCallback(async () => {
    const { data } = await supabase.from('zones').select('*').order('name');
    if (data) {
      setZones(data);
      if (data.length > 0 && !selectedZone) setSelectedZone(data[0].id);
    }
  }, [selectedZone]);

  useEffect(() => { fetchZones(); }, [fetchZones]);

  useEffect(() => {
    const ch = supabase
      .channel('zone_console_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zones' }, () => fetchZones())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchZones]);

  const fetchZoneData = useCallback(async (zoneId: string) => {
    const [complexesRes, atrRes, elevatorsRes, maintenanceRes, workflowRes, unassignedRes] = await Promise.all([
      supabase.from('complexes').select('*').eq('zone_id', zoneId),
      supabase.from('atr_units').select('id, complex_id, status'),
      supabase.from('elevators').select('id, complex_id, status'),
      supabase.from('maintenance_logs').select('id, complex_id, status').in('status', ['scheduled', 'in_progress']),
      supabase.from('workflow_executions').select('id, status'),
      supabase.from('complexes').select('*').is('zone_id', null),
    ]);

    const allComplexes = complexesRes.data || [];
    const atrs = atrRes.data || [];
    const elevators = elevatorsRes.data || [];
    const maintenance = maintenanceRes.data || [];

    const mapComplex = (c: Record<string, unknown>): ComplexDetail => ({
      id: c.id as string,
      name: c.name as string,
      status: c.status as string,
      total_parking_slots: (c.total_parking_slots as number) || 0,
      total_units: (c.total_units as number) || 0,
      zone_id: c.zone_id as string | null,
      atrCount: atrs.filter(a => a.complex_id === c.id).length,
      elevatorCount: elevators.filter(e => e.complex_id === c.id).length,
      maintenanceCount: maintenance.filter(m => m.complex_id === c.id).length,
    });

    setComplexes(allComplexes.map(mapComplex));
    setUnassignedComplexes((unassignedRes.data || []).map(mapComplex));

    const workflows = workflowRes.data || [];
    setWorkflowStats({
      running: workflows.filter(w => w.status === 'running').length,
      pending: workflows.filter(w => w.status === 'pending').length,
      completed: workflows.filter(w => w.status === 'completed').length,
    });
  }, []);

  useEffect(() => {
    if (selectedZone) fetchZoneData(selectedZone);
  }, [selectedZone, fetchZoneData]);

  const handleSaveZone = async () => {
    if (editingZone) {
      await supabase.from('zones').update({ name: zoneForm.name, code: zoneForm.code, status: zoneForm.status }).eq('id', editingZone.id);
      logAction('UPDATE', 'zones', editingZone.id, { name: zoneForm.name });
    } else {
      const region = zones.length > 0 ? zones[0].region_id : null;
      const { data } = await supabase.from('zones').insert({ ...zoneForm, region_id: region }).select('id').single();
      if (data) logAction('CREATE', 'zones', data.id, { name: zoneForm.name });
    }
    setZoneDialog(false);
    setEditingZone(null);
    setZoneForm(EMPTY_ZONE);
    fetchZones();
  };

  const handleDeleteZone = async (id: string) => {
    await supabase.from('complexes').update({ zone_id: null }).eq('zone_id', id);
    await supabase.from('zones').delete().eq('id', id);
    logAction('DELETE', 'zones', id, {});
    setSelectedZone('');
    fetchZones();
  };

  const handleAssignComplex = async (complexId: string) => {
    await supabase.from('complexes').update({ zone_id: selectedZone }).eq('id', complexId);
    logAction('UPDATE', 'complexes', complexId, { zone_id: selectedZone });
    fetchZoneData(selectedZone);
  };

  const handleUnassignComplex = async (complexId: string) => {
    await supabase.from('complexes').update({ zone_id: null }).eq('id', complexId);
    logAction('UPDATE', 'complexes', complexId, { zone_id: null });
    fetchZoneData(selectedZone);
  };

  const openEditZone = (zone: Zone) => {
    setEditingZone(zone);
    setZoneForm({ name: zone.name, code: zone.code, status: zone.status });
    setZoneDialog(true);
  };

  const totalAtrs = complexes.reduce((sum, c) => sum + c.atrCount, 0);
  const totalElevators = complexes.reduce((sum, c) => sum + c.elevatorCount, 0);
  const totalMaintenance = complexes.reduce((sum, c) => sum + c.maintenanceCount, 0);
  const currentZone = zones.find(z => z.id === selectedZone);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <MapIcon sx={{ color: theme.palette.success.main, fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>T2 Zone Console</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            존 단위 운영 조율 및 크로스 단지 관리
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/regions')}>Region Hub</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/complexes')}>단지 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/atr')}>ATR</Button>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>존 선택</InputLabel>
            <Select value={selectedZone} label="존 선택" onChange={(e) => setSelectedZone(e.target.value)}>
              {zones.map(z => (
                <MenuItem key={z.id} value={z.id}>{z.name} ({z.code})</MenuItem>
              ))}
            </Select>
          </FormControl>
          {currentZone && (
            <IconButton size="small" onClick={() => openEditZone(currentZone)}><EditIcon fontSize="small" /></IconButton>
          )}
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { setEditingZone(null); setZoneForm(EMPTY_ZONE); setZoneDialog(true); }}>
            존 추가
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <PrecisionManufacturingIcon sx={{ fontSize: 32, color: theme.palette.info.main, mb: 0.5 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{totalAtrs}</Typography>
            <Typography variant="caption" color="text.secondary">ATR 로봇</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <ElevatorIcon sx={{ fontSize: 32, color: theme.palette.warning.main, mb: 0.5 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{totalElevators}</Typography>
            <Typography variant="caption" color="text.secondary">엘리베이터</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <BuildIcon sx={{ fontSize: 32, color: theme.palette.error.main, mb: 0.5 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{totalMaintenance}</Typography>
            <Typography variant="caption" color="text.secondary">정비 진행중</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <EventNoteIcon sx={{ fontSize: 32, color: theme.palette.success.main, mb: 0.5 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{workflowStats.running}</Typography>
            <Typography variant="caption" color="text.secondary">실행중 워크플로우</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>존 내 단지 운영 현황</Typography>
            <Button size="small" variant="outlined" startIcon={<LinkIcon />} onClick={() => setAssignDialog(true)} disabled={unassignedComplexes.length === 0}>
              단지 배정
            </Button>
          </Box>
          {complexes.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              해당 존에 배정된 단지가 없습니다.
            </Typography>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>단지명</TableCell>
                    <TableCell align="center">상태</TableCell>
                    <TableCell align="center">ATR</TableCell>
                    <TableCell align="center">엘리베이터</TableCell>
                    <TableCell align="center">주차면</TableCell>
                    <TableCell align="center">정비</TableCell>
                    <TableCell>점유율</TableCell>
                    <TableCell align="center">해제</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {complexes.map((c) => {
                    const occupancy = c.total_parking_slots > 0 ? Math.min(50 + (c.atrCount * 10), 98) : 0;
                    return (
                      <TableRow key={c.id} hover>
                        <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{c.name}</Typography></TableCell>
                        <TableCell align="center">
                          <Chip label={c.status === 'active' ? '운영중' : c.status} size="small" color={c.status === 'active' ? 'success' : 'warning'} />
                        </TableCell>
                        <TableCell align="center">{c.atrCount}</TableCell>
                        <TableCell align="center">{c.elevatorCount}</TableCell>
                        <TableCell align="center">{c.total_parking_slots}</TableCell>
                        <TableCell align="center">
                          {c.maintenanceCount > 0 && <Chip label={c.maintenanceCount} size="small" color="warning" />}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                            <LinearProgress variant="determinate" value={occupancy}
                              sx={{ flex: 1, borderRadius: 1, height: 6 }}
                              color={occupancy > 85 ? 'error' : occupancy > 60 ? 'warning' : 'success'} />
                            <Typography variant="caption">{occupancy}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="error" onClick={() => handleUnassignComplex(c.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>워크플로우 상태</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 4 }}>
              <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }} color="warning.main">{workflowStats.pending}</Typography>
                <Typography variant="caption" color="text.secondary">대기중</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }} color="info.main">{workflowStats.running}</Typography>
                <Typography variant="caption" color="text.secondary">실행중</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }} color="success.main">{workflowStats.completed}</Typography>
                <Typography variant="caption" color="text.secondary">완료</Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Zone CRUD Dialog */}
      <Dialog open={zoneDialog} onClose={() => setZoneDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingZone ? '존 수정' : '새 존 추가'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="존 이름" value={zoneForm.name} onChange={e => setZoneForm({ ...zoneForm, name: e.target.value })} size="small" />
          <TextField label="존 코드" value={zoneForm.code} onChange={e => setZoneForm({ ...zoneForm, code: e.target.value })} size="small" />
          <FormControl size="small">
            <InputLabel>상태</InputLabel>
            <Select value={zoneForm.status} label="상태" onChange={e => setZoneForm({ ...zoneForm, status: e.target.value })}>
              <MenuItem value="active">활성</MenuItem>
              <MenuItem value="inactive">비활성</MenuItem>
            </Select>
          </FormControl>
          {editingZone && (
            <Button color="error" variant="outlined" onClick={() => { handleDeleteZone(editingZone.id); setZoneDialog(false); }}>
              존 삭제
            </Button>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setZoneDialog(false)}>취소</Button>
          <Button variant="contained" onClick={handleSaveZone} disabled={!zoneForm.name || !zoneForm.code}>저장</Button>
        </DialogActions>
      </Dialog>

      {/* Assign Complex Dialog */}
      <Dialog open={assignDialog} onClose={() => setAssignDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>단지 배정</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            미배정 단지를 현재 존에 배정합니다.
          </Typography>
          {unassignedComplexes.map(c => (
            <Box key={c.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="body2">{c.name}</Typography>
              <Button size="small" onClick={() => { handleAssignComplex(c.id); setAssignDialog(false); }}>배정</Button>
            </Box>
          ))}
          {unassignedComplexes.length === 0 && (
            <Typography variant="body2" color="text.secondary">모든 단지가 배정되어 있습니다.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialog(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

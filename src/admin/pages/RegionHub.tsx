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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import HubIcon from '@mui/icons-material/Hub';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import BoltIcon from '@mui/icons-material/Bolt';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTheme } from '@mui/material/styles';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useNavigate } from 'react-router-dom';

interface Region {
  id: string;
  name: string;
  code: string;
  country: string;
  timezone: string;
  status: string;
}

interface ZoneData {
  id: string;
  name: string;
  code: string;
  status: string;
  complexCount: number;
}

interface RegionForm {
  name: string;
  code: string;
  country: string;
  timezone: string;
  status: string;
}

const emptyForm: RegionForm = { name: '', code: '', country: '', timezone: 'Asia/Seoul', status: 'active' };

export default function RegionHub() {
  useDocumentTitle('T1 Region Hub');
  const navigate = useNavigate();
  const theme = useTheme();
  const { logAction } = useAuditLog();
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [regionComplexes, setRegionComplexes] = useState<Array<{ id: string; name: string; status: string; total_parking_slots: number; total_units: number }>>([]);
  const [parkingSessions, setParkingSessions] = useState<Record<string, number>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [form, setForm] = useState<RegionForm>(emptyForm);

  const fetchRegions = useCallback(async () => {
    const { data } = await supabase.from('regions').select('*').order('name');
    if (data) {
      setRegions(data);
      if (data.length > 0 && !selectedRegion) setSelectedRegion(data[0].id);
    }
  }, [selectedRegion]);

  const fetchRegionData = useCallback(async (regionId: string) => {
    const region = regions.find(r => r.id === regionId);
    if (!region) return;

    const [zonesRes, complexesRes] = await Promise.all([
      supabase.from('zones').select('*').eq('region_id', regionId),
      supabase.from('complexes').select('*').eq('region', region.code),
    ]);

    if (zonesRes.data) {
      const zoneData: ZoneData[] = zonesRes.data.map(z => ({
        id: z.id,
        name: z.name,
        code: z.code,
        status: z.status,
        complexCount: (complexesRes.data || []).filter(c => c.zone_id === z.id).length,
      }));
      setZones(zoneData);
    }

    if (complexesRes.data) {
      setRegionComplexes(complexesRes.data);
      const complexIds = complexesRes.data.map(c => c.id);
      if (complexIds.length > 0) {
        const { data: sessions } = await supabase
          .from('parking_sessions')
          .select('complex_id')
          .in('complex_id', complexIds)
          .is('exit_time', null);
        const counts: Record<string, number> = {};
        (sessions || []).forEach(s => { counts[s.complex_id] = (counts[s.complex_id] || 0) + 1; });
        setParkingSessions(counts);
      }
    }
  }, [regions]);

  useEffect(() => { fetchRegions(); }, [fetchRegions]);

  useEffect(() => {
    if (selectedRegion) fetchRegionData(selectedRegion);
  }, [selectedRegion, fetchRegionData]);

  useEffect(() => {
    const channel = supabase.channel('region-hub-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'regions' }, () => { fetchRegions(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complexes' }, () => { if (selectedRegion) fetchRegionData(selectedRegion); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchRegions, fetchRegionData, selectedRegion]);

  const handleOpenAdd = () => {
    setEditingRegion(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (r: Region) => {
    setEditingRegion(r);
    setForm({ name: r.name, code: r.code, country: r.country, timezone: r.timezone || 'Asia/Seoul', status: r.status });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = { name: form.name.trim(), code: form.code.trim().toUpperCase(), country: form.country.trim(), timezone: form.timezone, status: form.status };
    if (!payload.name || !payload.code) return;

    if (editingRegion) {
      await supabase.from('regions').update(payload).eq('id', editingRegion.id);
      logAction('update', `region:${editingRegion.id}`, editingRegion.id, { name: payload.name });
    } else {
      await supabase.from('regions').insert(payload);
      logAction('create', `region:${payload.code}`, payload.code, { name: payload.name });
    }
    setDialogOpen(false);
    setEditingRegion(null);
    setForm(emptyForm);
    fetchRegions();
  };

  const handleDelete = async () => {
    if (!editingRegion) return;
    if (!confirm('이 리전을 삭제하시겠습니까? 연결된 존과 단지 배정은 유지됩니다.')) return;
    await supabase.from('regions').delete().eq('id', editingRegion.id);
    logAction('delete', `region:${editingRegion.id}`, editingRegion.id, { name: editingRegion.name });
    setDialogOpen(false);
    setEditingRegion(null);
    setSelectedRegion('');
    fetchRegions();
  };

  const currentRegion = regions.find(r => r.id === selectedRegion);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <HubIcon sx={{ color: theme.palette.info.main, fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>T1 Region Hub</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            리전 단위 자원 배분 및 운영 최적화
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/zones')}>Zone Console</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/complexes')}>단지 관리</Button>
          <IconButton size="small" onClick={fetchRegions}><RefreshIcon fontSize="small" /></IconButton>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>리전 선택</InputLabel>
            <Select value={selectedRegion} label="리전 선택" onChange={(e) => setSelectedRegion(e.target.value)}>
              {regions.map(r => (
                <MenuItem key={r.id} value={r.id}>{r.name} ({r.code})</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd} size="small">
            리전 추가
          </Button>
        </Box>
      </Box>

      {/* Region KPIs */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">존(Zone)</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>{zones.length}</Typography>
                </Box>
                <GroupWorkIcon sx={{ fontSize: 36, color: theme.palette.info.main, opacity: 0.6 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">운영 단지</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>{regionComplexes.length}</Typography>
                </Box>
                <TrendingUpIcon sx={{ fontSize: 36, color: theme.palette.success.main, opacity: 0.6 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">총 주차면</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {regionComplexes.reduce((sum, c) => sum + (c.total_parking_slots || 0), 0).toLocaleString()}
                  </Typography>
                </Box>
                <BoltIcon sx={{ fontSize: 36, color: theme.palette.warning.main, opacity: 0.6 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">총 세대수</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {regionComplexes.reduce((sum, c) => sum + (c.total_units || 0), 0).toLocaleString()}
                  </Typography>
                </Box>
                <PeopleIcon sx={{ fontSize: 36, color: theme.palette.secondary.main, opacity: 0.6 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {/* Zone List */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  존(Zone) 현황 - {currentRegion?.name || ''}
                </Typography>
                {currentRegion && (
                  <IconButton size="small" onClick={() => handleOpenEdit(currentRegion)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
              {zones.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                  해당 리전에 등록된 존이 없습니다
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {zones.map(zone => (
                    <Box key={zone.id} sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', '&:hover': { borderColor: 'primary.main' } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{zone.name}</Typography>
                        <Chip label={zone.status} size="small" color={zone.status === 'active' ? 'success' : 'default'} />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        코드: {zone.code} | 단지: {zone.complexCount}개
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Complex List */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                리전 단지 목록
              </Typography>
              <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>단지명</TableCell>
                      <TableCell align="center">상태</TableCell>
                      <TableCell align="right">주차면</TableCell>
                      <TableCell align="right">세대수</TableCell>
                      <TableCell>가동률</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {regionComplexes.map((complex) => {
                      const parked = parkingSessions[complex.id] || 0;
                      const occupancy = complex.total_parking_slots > 0
                        ? (parked / complex.total_parking_slots) * 100
                        : 0;
                      return (
                        <TableRow key={complex.id} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{complex.name}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={complex.status}
                              size="small"
                              color={complex.status === 'active' ? 'success' : complex.status === 'poc' ? 'warning' : 'default'}
                            />
                          </TableCell>
                          <TableCell align="right">{complex.total_parking_slots}</TableCell>
                          <TableCell align="right">{complex.total_units}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(occupancy, 100)}
                                sx={{ flex: 1, borderRadius: 1, height: 6 }}
                                color={occupancy > 85 ? 'error' : occupancy > 60 ? 'warning' : 'success'}
                              />
                              <Typography variant="caption" sx={{ minWidth: 36 }}>
                                {occupancy.toFixed(0)}%
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {regionComplexes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                            해당 리전에 등록된 단지가 없습니다
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Region Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingRegion ? '리전 수정' : '리전 추가'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="리전명" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
          <TextField label="코드 (예: KR, JP)" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} fullWidth />
          <TextField label="국가" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} fullWidth />
          <TextField label="타임존" value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} fullWidth />
          <FormControl fullWidth>
            <InputLabel>상태</InputLabel>
            <Select value={form.status} label="상태" onChange={e => setForm({ ...form, status: e.target.value })}>
              <MenuItem value="active">운영중</MenuItem>
              <MenuItem value="poc">PoC</MenuItem>
              <MenuItem value="planned">계획중</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ justifyContent: editingRegion ? 'space-between' : 'flex-end', px: 3, pb: 2 }}>
          {editingRegion && (
            <Button color="error" onClick={handleDelete}>삭제</Button>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setDialogOpen(false)}>취소</Button>
            <Button variant="contained" onClick={handleSave} disabled={!form.name.trim() || !form.code.trim()}>
              {editingRegion ? '저장' : '추가'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

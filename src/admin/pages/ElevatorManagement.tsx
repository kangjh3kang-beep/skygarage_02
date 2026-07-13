import { useState, useEffect, useCallback, useMemo } from 'react';
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
import Skeleton from '@mui/material/Skeleton';
import Chip from '@mui/material/Chip';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ApartmentIcon from '@mui/icons-material/Apartment';
import CloseIcon from '@mui/icons-material/Close';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';

interface Elevator {
  id: string;
  complex_id: string;
  elevator_code: string;
  status: string;
  current_floor: number;
  max_floor: number;
  min_floor: number;
  load_kg: number;
  total_trips: number;
  last_maintenance: string | null;
  building_name: string;
  manufacturer: string;
  model: string;
  commissioned_at: string | null;
  inspection_due: string | null;
  adapter_type: string;
  speed_mps: number;
  door_width_mm: number;
  car_depth_mm: number;
  completeness_score: number;
  vendor: string;
}

interface Complex { id: string; name: string; }

const STEPS = ['기본 정보', '물리 사양', 'SkyGarage 연동', '확인'];

interface FormData {
  elevator_code: string;
  building_name: string;
  manufacturer: string;
  model: string;
  status: string;
  max_floor: string;
  min_floor: string;
  load_kg: string;
  speed_mps: string;
  door_width_mm: string;
  car_depth_mm: string;
  adapter_type: string;
  inspection_due: string;
  commissioned_at: string;
  complex_id: string;
}

const emptyForm: FormData = {
  elevator_code: '', building_name: '', manufacturer: '', model: '',
  status: 'operational', max_floor: '30', min_floor: '-3', load_kg: '5000',
  speed_mps: '1.5', door_width_mm: '900', car_depth_mm: '2100',
  adapter_type: 'none', inspection_due: '', commissioned_at: '', complex_id: '',
};

const statusMap: Record<string, { color: 'success' | 'warning' | 'error'; label: string }> = {
  operational: { color: 'success', label: '정상' },
  occupied: { color: 'success', label: '운행중' },
  maintenance: { color: 'warning', label: '점검중' },
  out_of_service: { color: 'error', label: '운행중지' },
  offline: { color: 'error', label: '오프라인' },
};

function calcCompleteness(form: FormData): number {
  const fields = [form.elevator_code, form.building_name, form.manufacturer, form.model, form.complex_id, form.adapter_type !== 'none' ? form.adapter_type : '', form.commissioned_at, form.inspection_due, form.load_kg, form.speed_mps];
  const filled = fields.filter(f => !!f && f !== '0').length;
  return Math.round((filled / fields.length) * 100);
}

export default function ElevatorManagement() {
  useDocumentTitle('엘리베이터 관리');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Elevator | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Elevator | null>(null);
  const [detailElevator, setDetailElevator] = useState<Elevator | null>(null);

  const completeness = useMemo(() => calcCompleteness(form), [form]);

  const loadData = useCallback(async () => {
    const [eRes, cRes] = await Promise.all([
      supabase.from('elevators').select('*').order('elevator_code'),
      supabase.from('complexes').select('id, name'),
    ]);
    if (eRes.data) setElevators(eRes.data);
    if (cRes.data) setComplexes(cRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('elevators-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'elevators' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        elevator_code: form.elevator_code,
        building_name: form.building_name,
        manufacturer: form.manufacturer,
        model: form.model,
        status: form.status,
        max_floor: parseInt(form.max_floor) || 30,
        min_floor: parseInt(form.min_floor) || -3,
        load_kg: parseInt(form.load_kg) || 5000,
        speed_mps: parseFloat(form.speed_mps) || 1.5,
        door_width_mm: parseInt(form.door_width_mm) || 900,
        car_depth_mm: parseInt(form.car_depth_mm) || 2100,
        adapter_type: form.adapter_type,
        inspection_due: form.inspection_due || null,
        commissioned_at: form.commissioned_at || null,
        complex_id: form.complex_id || null,
        completeness_score: completeness,
      };

      if (editing) {
        const { error } = await supabase.from('elevators').update(payload).eq('id', editing.id);
        if (error) { showToast('수정 실패: ' + error.message, 'error'); return; }
        logAction('UPDATE', 'elevators', editing.id, { code: payload.elevator_code });
        showToast('엘리베이터 정보가 수정되었습니다.', 'success');
      } else {
        const { error } = await supabase.from('elevators').insert(payload);
        if (error) { showToast('등록 실패: ' + error.message, 'error'); return; }
        logAction('CREATE', 'elevators', undefined, { code: payload.elevator_code });
        showToast('엘리베이터가 등록되었습니다.', 'success');
      }
      setDialogOpen(false);
      setActiveStep(0);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('elevators').delete().eq('id', deleteTarget.id);
    if (error) { showToast('삭제 실패', 'error'); return; }
    logAction('DELETE', 'elevators', deleteTarget.id, { code: deleteTarget.elevator_code });
    showToast('삭제 완료', 'success');
    setDeleteTarget(null);
    loadData();
  };

  const openNew = async () => {
    setEditing(null);
    setForm(emptyForm);
    setActiveStep(0);
    setDialogOpen(true);
    const { data } = await supabase.rpc('generate_entity_code', { prefix: 'ELV' });
    if (data) setForm(f => ({ ...f, elevator_code: data }));
  };
  const openEdit = (e: Elevator) => {
    setEditing(e);
    setForm({
      elevator_code: e.elevator_code, building_name: e.building_name || '', manufacturer: e.manufacturer || '',
      model: e.model || '', status: e.status, max_floor: String(e.max_floor || 30),
      min_floor: String(e.min_floor || -3), load_kg: String(e.load_kg || 5000),
      speed_mps: String(e.speed_mps || 1.5), door_width_mm: String(e.door_width_mm || 900),
      car_depth_mm: String(e.car_depth_mm || 2100), adapter_type: e.adapter_type || 'none',
      inspection_due: e.inspection_due || '', commissioned_at: e.commissioned_at?.slice(0, 10) || '',
      complex_id: e.complex_id || '',
    });
    setActiveStep(0);
    setDialogOpen(true);
  };

  const complexName = (id: string) => complexes.find(c => c.id === id)?.name || '-';
  const operationalCount = elevators.filter(e => ['operational', 'occupied'].includes(e.status)).length;

  if (loading) return <Box>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rectangular" height={48} sx={{ mb: 1, borderRadius: 1 }} />)}</Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>엘리베이터 관리</Typography>
          <Typography variant="body2" color="text.secondary">차량용 엘리베이터 등록 및 SkyGarage 연동</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/complexes')}>단지 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/atr')}>ATR 로봇</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/maintenance')}>정비 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/alerts')}>알림 센터</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>엘리베이터 등록</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">전체</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{elevators.length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">정상 가동</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }} color="success.main">{operationalCount}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">SG 연동</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{elevators.filter(e => e.adapter_type && e.adapter_type !== 'none').length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">총 운행</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{elevators.reduce((s, e) => s + (e.total_trips || 0), 0).toLocaleString()}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>코드</TableCell>
              <TableCell>단지/동</TableCell>
              <TableCell>제조사</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>어댑터</TableCell>
              <TableCell align="center">완성도</TableCell>
              <TableCell align="center">관리</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {elevators.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center"><Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>등록된 엘리베이터가 없습니다</Typography></TableCell></TableRow>
              ) : elevators.map(e => {
                const st = statusMap[e.status] || { color: 'default' as const, label: e.status };
                return (
                  <TableRow key={e.id} hover onClick={() => setDetailElevator(e)} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.75rem' }}>{e.elevator_code}</Typography></TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <ApartmentIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', lineHeight: 1.2 }}>{complexName(e.complex_id)}</Typography>
                          {e.building_name && <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{e.building_name}</Typography>}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="caption">{e.manufacturer || '-'}</Typography></TableCell>
                    <TableCell><Chip label={st.label} size="small" color={st.color} /></TableCell>
                    <TableCell><Chip label={e.adapter_type || 'none'} size="small" variant="outlined" color={e.adapter_type && e.adapter_type !== 'none' ? 'primary' : 'default'} sx={{ fontSize: '0.65rem' }} /></TableCell>
                    <TableCell align="center">
                      {(e.completeness_score || 0) >= 80 ? <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} /> : <WarningIcon sx={{ fontSize: 14, color: 'warning.main' }} />}
                    </TableCell>
                    <TableCell align="center" onClick={ev => ev.stopPropagation()}>
                      <IconButton size="small" onClick={() => openEdit(e)}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                      <IconButton size="small" onClick={() => setDeleteTarget(e)} sx={{ color: 'error.main' }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Registration Stepper Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{editing ? '엘리베이터 수정' : '엘리베이터 등록'}</Typography>
          <Typography variant="caption" color="text.secondary">SkyGarage 차량 엘리베이터 체계 등록</Typography>
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }}>
            {STEPS.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>

          <Alert severity="info" sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>데이터 완성도</Typography>
                <LinearProgress variant="determinate" value={completeness} sx={{ mt: 0.5, width: 160, borderRadius: 1, height: 6 }} color={completeness >= 80 ? 'success' : 'warning'} />
              </Box>
              <Chip label={`${completeness}%`} size="small" color={completeness >= 80 ? 'success' : 'warning'} />
            </Box>
          </Alert>

          {activeStep === 0 && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                {!editing ? (
                  <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">엔티티 코드 (자동 생성)</Typography>
                    <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{form.elevator_code || '생성 중...'}</Typography>
                  </Box>
                ) : (
                  <TextField label="엘리베이터 코드 *" value={form.elevator_code} onChange={e => setForm({ ...form, elevator_code: e.target.value })} fullWidth size="small" />
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="동/위치" value={form.building_name} onChange={e => setForm({ ...form, building_name: e.target.value })} fullWidth size="small" placeholder="101동" /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="제조사" value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} fullWidth size="small" placeholder="현대엘리베이터, 오티스 등" /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="모델명" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} fullWidth size="small" /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="설치일" type="date" value={form.commissioned_at} onChange={e => setForm({ ...form, commissioned_at: e.target.value })} fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="상태" select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} fullWidth size="small">
                <MenuItem value="operational">정상</MenuItem><MenuItem value="maintenance">점검중</MenuItem><MenuItem value="out_of_service">운행중지</MenuItem><MenuItem value="offline">오프라인</MenuItem>
              </TextField></Grid>
            </Grid>
          )}

          {activeStep === 1 && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, sm: 4 }}><TextField label="최고층" type="number" value={form.max_floor} onChange={e => setForm({ ...form, max_floor: e.target.value })} fullWidth size="small" /></Grid>
              <Grid size={{ xs: 6, sm: 4 }}><TextField label="최저층" type="number" value={form.min_floor} onChange={e => setForm({ ...form, min_floor: e.target.value })} fullWidth size="small" /></Grid>
              <Grid size={{ xs: 6, sm: 4 }}><TextField label="적재 용량 (kg)" type="number" value={form.load_kg} onChange={e => setForm({ ...form, load_kg: e.target.value })} fullWidth size="small" /></Grid>
              <Grid size={{ xs: 6, sm: 4 }}><TextField label="속도 (m/s)" type="number" value={form.speed_mps} onChange={e => setForm({ ...form, speed_mps: e.target.value })} fullWidth size="small" slotProps={{ input: { inputProps: { step: 0.1 } } }} /></Grid>
              <Grid size={{ xs: 6, sm: 4 }}><TextField label="도어 폭 (mm)" type="number" value={form.door_width_mm} onChange={e => setForm({ ...form, door_width_mm: e.target.value })} fullWidth size="small" /></Grid>
              <Grid size={{ xs: 6, sm: 4 }}><TextField label="카 깊이 (mm)" type="number" value={form.car_depth_mm} onChange={e => setForm({ ...form, car_depth_mm: e.target.value })} fullWidth size="small" /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="다음 법정검사일" type="date" value={form.inspection_due} onChange={e => setForm({ ...form, inspection_due: e.target.value })} fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} /></Grid>
            </Grid>
          )}

          {activeStep === 2 && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <TextField label="배치 단지" select value={form.complex_id} onChange={e => setForm({ ...form, complex_id: e.target.value })} fullWidth size="small">
                  <MenuItem value="">선택하세요</MenuItem>
                  {complexes.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField label="SkyGarage 어댑터 타입" select value={form.adapter_type} onChange={e => setForm({ ...form, adapter_type: e.target.value })} fullWidth size="small">
                  <MenuItem value="none">미연동</MenuItem>
                  <MenuItem value="direct">직입형 (ATR 직접 탑승)</MenuItem>
                  <MenuItem value="valet">발렛형 (발렛 호출)</MenuItem>
                  <MenuItem value="tower">타워형 (주차타워 연동)</MenuItem>
                  <MenuItem value="hybrid">하이브리드</MenuItem>
                </TextField>
              </Grid>
              {form.adapter_type !== 'none' && (
                <Grid size={{ xs: 12 }}>
                  <Alert severity="success" sx={{ fontSize: '0.8rem' }}>
                    SkyGarage 어댑터가 연동되면 ATR 로봇이 엘리베이터를 자동 호출하여 차량을 이송합니다. 도어 폭 {form.door_width_mm}mm, 카 깊이 {form.car_depth_mm}mm 기준으로 차량 적합성이 자동 판정됩니다.
                  </Alert>
                </Grid>
              )}
            </Grid>
          )}

          {activeStep === 3 && (
            <Card variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700 }}>등록 확인</Typography>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">코드</Typography><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{form.elevator_code}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">동/위치</Typography><Typography variant="body2">{form.building_name || '-'}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">제조사</Typography><Typography variant="body2">{form.manufacturer || '-'}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">적재</Typography><Typography variant="body2">{form.load_kg} kg</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">층수</Typography><Typography variant="body2">{form.min_floor}F ~ {form.max_floor}F</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">어댑터</Typography><Typography variant="body2">{form.adapter_type}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">단지</Typography><Typography variant="body2">{complexName(form.complex_id)}</Typography></Grid>
              </Grid>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">완성도:</Typography>
                <Chip label={completeness >= 80 ? '우수' : '추가 입력 권장'} size="small" color={completeness >= 80 ? 'success' : 'warning'} />
              </Box>
            </Card>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {activeStep > 0 && <Button onClick={() => setActiveStep(s => s - 1)}>이전</Button>}
            {activeStep < STEPS.length - 1 ? (
              <Button variant="contained" onClick={() => setActiveStep(s => s + 1)} disabled={activeStep === 0 && !form.elevator_code}>다음</Button>
            ) : (
              <Button variant="contained" onClick={handleSave} disabled={saving || !form.elevator_code}>{saving ? '저장 중...' : editing ? '수정' : '등록'}</Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>엘리베이터 삭제</DialogTitle>
        <DialogContent><Typography>"{deleteTarget?.elevator_code}" 엘리베이터를 삭제하시겠습니까?</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDeleteTarget(null)}>취소</Button><Button variant="contained" color="error" onClick={handleDelete}>삭제</Button></DialogActions>
      </Dialog>

      {/* Elevator Detail Dialog */}
      <Dialog open={!!detailElevator} onClose={() => setDetailElevator(null)} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        {detailElevator && (() => {
          const st = statusMap[detailElevator.status] || { color: 'default' as const, label: detailElevator.status };
          return (
            <>
              <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>엘리베이터 상세</Typography>
                  <Chip label={st.label} size="small" color={st.color} />
                </Box>
                <IconButton size="small" onClick={() => setDetailElevator(null)}><CloseIcon fontSize="small" /></IconButton>
              </DialogTitle>
              <DialogContent>
                {/* Location Context */}
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>소속 단지/건물</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <ApartmentIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{complexName(detailElevator.complex_id)}</Typography>
                      {detailElevator.building_name && <Typography variant="caption" color="text.secondary">{detailElevator.building_name}</Typography>}
                    </Box>
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Equipment Info */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>장비 코드</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{detailElevator.elevator_code}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>제조사/모델</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{detailElevator.manufacturer || '-'} {detailElevator.model || ''}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>운행 층</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{detailElevator.min_floor || 'B?'}F ~ {detailElevator.max_floor || '?'}F</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>현재 층</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{detailElevator.current_floor || '-'}F</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>최대 하중</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{detailElevator.load_kg ? `${detailElevator.load_kg}kg` : '-'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>속도</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{detailElevator.speed_mps ? `${detailElevator.speed_mps}m/s` : '-'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>도어 폭</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{detailElevator.door_width_mm ? `${detailElevator.door_width_mm}mm` : '-'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>카 깊이</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{detailElevator.car_depth_mm ? `${detailElevator.car_depth_mm}mm` : '-'}</Typography>
                  </Grid>
                </Grid>

                {/* Integration & Maintenance */}
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>SkyGarage 어댑터</Typography>
                    <Chip label={detailElevator.adapter_type || 'none'} size="small" variant="outlined" color={detailElevator.adapter_type && detailElevator.adapter_type !== 'none' ? 'primary' : 'default'} />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>총 운행 횟수</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{(detailElevator.total_trips || 0).toLocaleString()}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>최종 정비</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{detailElevator.last_maintenance ? new Date(detailElevator.last_maintenance).toLocaleDateString('ko-KR') : '-'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>검사 예정</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: detailElevator.inspection_due && new Date(detailElevator.inspection_due) < new Date() ? 'error.main' : 'text.primary' }}>
                      {detailElevator.inspection_due ? new Date(detailElevator.inspection_due).toLocaleDateString('ko-KR') : '-'}
                    </Typography>
                  </Grid>
                </Grid>

                {/* Actions */}
                <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
                  <Button variant="outlined" size="small" onClick={() => { setDetailElevator(null); openEdit(detailElevator); }}>수정</Button>
                  <Button variant="outlined" size="small" onClick={() => navigate('/admin/maintenance')}>정비 이력</Button>
                </Box>
              </DialogContent>
            </>
          );
        })()}
      </Dialog>
    </Box>
  );
}

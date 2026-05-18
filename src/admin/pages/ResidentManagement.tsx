import { useState, useEffect, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
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
import InputAdornment from '@mui/material/InputAdornment';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AccessibleIcon from '@mui/icons-material/Accessible';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';

interface Resident {
  id: string;
  complex_id: string;
  registration_code: string | null;
  name: string;
  unit_number: string;
  phone: string;
  email: string;
  status: string;
  household_size: number;
  vehicle_count: number;
  move_in_date: string | null;
  emergency_contact: string;
  parking_assigned: boolean;
  plan_type: string;
  monthly_fee: number;
  completeness_score: number;
  notes: string;
  created_at: string;
}

interface Vehicle {
  id: string;
  resident_id: string;
  plate_number: string;
  vehicle_type: string;
  is_ev: boolean;
}

interface Complex {
  id: string;
  name: string;
  mdm_code: string | null;
}

const STEPS = ['기본 정보', '거주 상세', '차량/주차', '확인'];

interface FormData {
  name: string;
  unit_number: string;
  phone: string;
  email: string;
  complex_id: string;
  status: string;
  household_size: string;
  move_in_date: string;
  emergency_contact: string;
  plan_type: string;
  monthly_fee: string;
  parking_assigned: string;
  vehicle_count: string;
  notes: string;
}

const emptyForm: FormData = {
  name: '', unit_number: '', phone: '', email: '', complex_id: '',
  status: 'active', household_size: '1', move_in_date: '', emergency_contact: '',
  plan_type: 'monthly', monthly_fee: '0', parking_assigned: 'false',
  vehicle_count: '0', notes: '',
};

function calcCompleteness(form: FormData): number {
  const fields = [form.name, form.unit_number, form.phone, form.email, form.complex_id, form.household_size, form.move_in_date, form.emergency_contact, form.plan_type, form.monthly_fee];
  const filled = fields.filter(f => f && f !== '0' && f !== 'false').length;
  return Math.round((filled / fields.length) * 100);
}

export default function ResidentManagement() {
  useDocumentTitle('입주민 관리');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Resident | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Resident | null>(null);
  const [vehicleDialog, setVehicleDialog] = useState<Resident | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleForm, setVehicleForm] = useState({ plate_number: '', vehicle_type: '', is_ev: false });
  const [accessibilityMap, setAccessibilityMap] = useState<Record<string, string>>({});

  const completeness = useMemo(() => calcCompleteness(form), [form]);

  const loadData = useCallback(async () => {
    const [rRes, cRes, apRes] = await Promise.all([
      supabase.from('resident_accounts').select('*').order('name'),
      supabase.from('complexes').select('id, name, mdm_code'),
      supabase.from('resident_accessibility_profiles').select('resident_id, category').eq('active', true),
    ]);
    if (rRes.data) setResidents(rRes.data);
    if (cRes.data) setComplexes(cRes.data);
    if (apRes.data) {
      const map: Record<string, string> = {};
      apRes.data.forEach(p => { map[p.resident_id] = p.category; });
      setAccessibilityMap(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('residents-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resident_accounts' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const loadVehicles = useCallback(async (residentId: string) => {
    const { data } = await supabase.from('resident_vehicles').select('*').eq('resident_id', residentId);
    if (data) setVehicles(data);
  }, []);

  const canProceed = (step: number): boolean => {
    if (step === 0) return !!form.name && !!form.unit_number && !!form.complex_id;
    if (step === 1) return !!form.phone;
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let regCode = editing?.registration_code || null;
      if (!editing) {
        const { data: codeData } = await supabase.rpc('generate_entity_code', { p_entity_type: 'resident', p_prefix: 'RES' });
        regCode = codeData;
      }

      const payload = {
        name: form.name,
        unit_number: form.unit_number,
        phone: form.phone,
        email: form.email,
        complex_id: form.complex_id || null,
        status: form.status,
        household_size: parseInt(form.household_size) || 1,
        move_in_date: form.move_in_date || null,
        emergency_contact: form.emergency_contact,
        plan_type: form.plan_type,
        monthly_fee: parseFloat(form.monthly_fee) || 0,
        parking_assigned: form.parking_assigned === 'true',
        vehicle_count: parseInt(form.vehicle_count) || 0,
        notes: form.notes,
        registration_code: regCode,
        completeness_score: completeness,
      };

      if (editing) {
        const { error } = await supabase.from('resident_accounts').update(payload).eq('id', editing.id);
        if (error) { showToast('수정 실패: ' + error.message, 'error'); return; }
        logAction('UPDATE', 'resident_accounts', editing.id, { name: payload.name, registration_code: regCode });
        showToast('입주민 정보가 수정되었습니다.', 'success');
      } else {
        const { error } = await supabase.from('resident_accounts').insert(payload);
        if (error) { showToast('등록 실패: ' + error.message, 'error'); return; }
        logAction('CREATE', 'resident_accounts', undefined, { name: payload.name, registration_code: regCode });
        showToast('입주민이 등록되었습니다.', 'success');
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
    const { error } = await supabase.from('resident_accounts').delete().eq('id', deleteTarget.id);
    if (error) { showToast('삭제 실패: ' + error.message, 'error'); return; }
    logAction('DELETE', 'resident_accounts', deleteTarget.id, { name: deleteTarget.name });
    showToast('삭제 완료', 'success');
    setDeleteTarget(null);
    loadData();
  };

  const handleAddVehicle = async () => {
    if (!vehicleDialog) return;
    const payload = { resident_id: vehicleDialog.id, ...vehicleForm };
    const { error } = await supabase.from('resident_vehicles').insert(payload);
    if (error) { showToast('차량 등록 실패: ' + error.message, 'error'); return; }
    logAction('CREATE', 'resident_vehicles', undefined, { plate: vehicleForm.plate_number });
    showToast('차량이 등록되었습니다.', 'success');
    setVehicleForm({ plate_number: '', vehicle_type: '', is_ev: false });
    loadVehicles(vehicleDialog.id);
  };

  const handleDeleteVehicle = async (v: Vehicle) => {
    const { error } = await supabase.from('resident_vehicles').delete().eq('id', v.id);
    if (error) { showToast('삭제 실패', 'error'); return; }
    logAction('DELETE', 'resident_vehicles', v.id, { plate: v.plate_number });
    if (vehicleDialog) loadVehicles(vehicleDialog.id);
  };

  const openNewDialog = () => {
    setEditing(null);
    setForm(emptyForm);
    setActiveStep(0);
    setDialogOpen(true);
  };

  const openEditDialog = (r: Resident) => {
    setEditing(r);
    setForm({
      name: r.name,
      unit_number: r.unit_number,
      phone: r.phone || '',
      email: r.email || '',
      complex_id: r.complex_id || '',
      status: r.status || 'active',
      household_size: String(r.household_size || 1),
      move_in_date: r.move_in_date || '',
      emergency_contact: r.emergency_contact || '',
      plan_type: r.plan_type || 'monthly',
      monthly_fee: String(r.monthly_fee || 0),
      parking_assigned: String(r.parking_assigned || false),
      vehicle_count: String(r.vehicle_count || 0),
      notes: r.notes || '',
    });
    setActiveStep(0);
    setDialogOpen(true);
  };

  const filtered = residents.filter(r =>
    !search || r.name?.includes(search) || r.unit_number?.includes(search) || r.phone?.includes(search) || r.registration_code?.includes(search)
  );

  const complexName = (id: string) => complexes.find(c => c.id === id)?.name || '-';

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} variant="rectangular" height={48} sx={{ mb: 1, borderRadius: 1 }} />)}
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>입주민 관리</Typography>
          <Typography variant="body2" color="text.secondary">MDM 기반 입주민 등록 및 관리 시스템</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/ai-management')}>AI 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/workflows')}>워크플로우</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/complexes')}>단지 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/parking')}>주차 운영</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNewDialog}>입주민 등록</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">전체 입주민</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{residents.length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">활성</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }} color="success.main">{residents.filter(r => r.status === 'active').length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">평균 완성도</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{residents.length > 0 ? Math.round(residents.reduce((s, r) => s + (r.completeness_score || 0), 0) / residents.length) : 0}%</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">연결 단지</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{new Set(residents.filter(r => r.complex_id).map(r => r.complex_id)).size}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <TextField size="small" placeholder="이름, 호수, 전화번호, 등록코드 검색" value={search} onChange={e => setSearch(e.target.value)} sx={{ mb: 2, width: 360 }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>등록코드</TableCell>
              <TableCell>이름</TableCell>
              <TableCell>호수</TableCell>
              <TableCell>단지</TableCell>
              <TableCell>전화번호</TableCell>
              <TableCell align="center">교통약자</TableCell>
              <TableCell align="center">완성도</TableCell>
              <TableCell>상태</TableCell>
              <TableCell align="center">관리</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} align="center"><Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>입주민 데이터가 없습니다</Typography></TableCell></TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'text.secondary' }}>
                      {r.registration_code || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{r.name}</Typography></TableCell>
                  <TableCell>{r.unit_number}</TableCell>
                  <TableCell><Typography variant="caption">{complexName(r.complex_id)}</Typography></TableCell>
                  <TableCell>{r.phone || '-'}</TableCell>
                  <TableCell align="center">
                    {accessibilityMap[r.id] ? (
                      <Chip
                        icon={<AccessibleIcon />}
                        label={accessibilityMap[r.id] === 'elderly' ? '노약자' : accessibilityMap[r.id] === 'disabled' ? '장애인' : accessibilityMap[r.id] === 'pregnant' ? '임산부' : accessibilityMap[r.id] === 'child_companion' ? '영유아' : '부상'}
                        size="small"
                        color="warning"
                        variant="outlined"
                        sx={{ height: 22, fontSize: '0.65rem' }}
                      />
                    ) : '-'}
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                      {(r.completeness_score || 0) >= 80
                        ? <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                        : <WarningIcon sx={{ fontSize: 14, color: 'warning.main' }} />}
                      <Typography variant="caption">{r.completeness_score || 0}%</Typography>
                    </Box>
                  </TableCell>
                  <TableCell><Chip label={r.status || 'active'} size="small" color={r.status === 'active' ? 'success' : 'default'} /></TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => { setVehicleDialog(r); loadVehicles(r.id); }}><DirectionsCarIcon sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton size="small" onClick={() => openEditDialog(r)}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton size="small" onClick={() => setDeleteTarget(r)} sx={{ color: 'error.main' }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Registration Stepper Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{editing ? '입주민 수정' : '입주민 등록'}</Typography>
          <Typography variant="caption" color="text.secondary">MDM 기반 체계적 입주민 등록</Typography>
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }}>
            {STEPS.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>

          <Alert severity="info" sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>데이터 완성도</Typography>
                <LinearProgress variant="determinate" value={completeness} sx={{ mt: 0.5, width: 160, borderRadius: 1, height: 6 }} color={completeness >= 80 ? 'success' : completeness >= 50 ? 'warning' : 'error'} />
              </Box>
              <Chip label={`${completeness}%`} size="small" color={completeness >= 80 ? 'success' : 'warning'} />
            </Box>
          </Alert>

          {activeStep === 0 && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="이름 *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth size="small" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="호수 *" value={form.unit_number} onChange={e => setForm({ ...form, unit_number: e.target.value })} fullWidth size="small" placeholder="예: 101동 1501호" />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField label="소속 단지 *" select value={form.complex_id} onChange={e => setForm({ ...form, complex_id: e.target.value })} fullWidth size="small">
                  <MenuItem value="">선택하세요</MenuItem>
                  {complexes.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.mdm_code && <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>({c.mdm_code})</Typography>}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="상태" select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} fullWidth size="small">
                  <MenuItem value="active">활성</MenuItem>
                  <MenuItem value="inactive">비활성</MenuItem>
                  <MenuItem value="pending">대기</MenuItem>
                  <MenuItem value="moved_out">퇴거</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="가구원 수" type="number" value={form.household_size} onChange={e => setForm({ ...form, household_size: e.target.value })} fullWidth size="small" slotProps={{ input: { inputProps: { min: 1, max: 10 } } }} />
              </Grid>
            </Grid>
          )}

          {activeStep === 1 && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="전화번호 *" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} fullWidth size="small" placeholder="010-0000-0000" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="이메일" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} fullWidth size="small" type="email" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="입주일" type="date" value={form.move_in_date} onChange={e => setForm({ ...form, move_in_date: e.target.value })} fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="비상 연락처" value={form.emergency_contact} onChange={e => setForm({ ...form, emergency_contact: e.target.value })} fullWidth size="small" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="요금제" select value={form.plan_type} onChange={e => setForm({ ...form, plan_type: e.target.value })} fullWidth size="small">
                  <MenuItem value="monthly">월정액</MenuItem>
                  <MenuItem value="usage">종량제</MenuItem>
                  <MenuItem value="premium">프리미엄</MenuItem>
                  <MenuItem value="free">무료</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="월 이용료 (원)" type="number" value={form.monthly_fee} onChange={e => setForm({ ...form, monthly_fee: e.target.value })} fullWidth size="small" />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField label="메모" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth size="small" multiline rows={2} />
              </Grid>
            </Grid>
          )}

          {activeStep === 2 && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="보유 차량 수" type="number" value={form.vehicle_count} onChange={e => setForm({ ...form, vehicle_count: e.target.value })} fullWidth size="small" slotProps={{ input: { inputProps: { min: 0, max: 5 } } }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="주차 배정" select value={form.parking_assigned} onChange={e => setForm({ ...form, parking_assigned: e.target.value })} fullWidth size="small">
                  <MenuItem value="true">배정 완료</MenuItem>
                  <MenuItem value="false">미배정</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
                  차량 상세 정보는 등록 완료 후 차량 관리 기능에서 추가할 수 있습니다.
                </Alert>
              </Grid>
            </Grid>
          )}

          {activeStep === 3 && (
            <Card variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700 }}>등록 정보 확인</Typography>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">이름</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{form.name}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">호수</Typography><Typography variant="body2">{form.unit_number}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">단지</Typography><Typography variant="body2">{complexName(form.complex_id)}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">전화</Typography><Typography variant="body2">{form.phone || '-'}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">요금제</Typography><Typography variant="body2">{form.plan_type}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">가구원</Typography><Typography variant="body2">{form.household_size}명</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">차량</Typography><Typography variant="body2">{form.vehicle_count}대</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">주차</Typography><Typography variant="body2">{form.parking_assigned === 'true' ? '배정' : '미배정'}</Typography></Grid>
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
              <Button variant="contained" onClick={() => setActiveStep(s => s + 1)} disabled={!canProceed(activeStep)}>다음</Button>
            ) : (
              <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>{saving ? '저장 중...' : editing ? '수정 완료' : '등록 완료'}</Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>입주민 삭제</DialogTitle>
        <DialogContent><Typography>"{deleteTarget?.name}" 님을 삭제하시겠습니까?</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDeleteTarget(null)}>취소</Button><Button variant="contained" color="error" onClick={handleDelete}>삭제</Button></DialogActions>
      </Dialog>

      {/* Vehicle Management Dialog */}
      <Dialog open={!!vehicleDialog} onClose={() => setVehicleDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{vehicleDialog?.name} - 차량 관리</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, mt: 1 }}>
            <TextField label="차량번호" size="small" value={vehicleForm.plate_number} onChange={e => setVehicleForm({ ...vehicleForm, plate_number: e.target.value })} />
            <TextField label="차종" size="small" value={vehicleForm.vehicle_type} onChange={e => setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value })} />
            <Button variant="contained" size="small" onClick={handleAddVehicle} disabled={!vehicleForm.plate_number}>추가</Button>
          </Box>
          {vehicles.map(v => (
            <Box key={v.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
              <Typography variant="body2">{v.plate_number} ({v.vehicle_type || '-'}) {v.is_ev && <Chip label="EV" size="small" color="success" sx={{ ml: 1 }} />}</Typography>
              <IconButton size="small" onClick={() => handleDeleteVehicle(v)} sx={{ color: 'error.main' }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton>
            </Box>
          ))}
          {vehicles.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>등록된 차량이 없습니다</Typography>}
        </DialogContent>
        <DialogActions><Button onClick={() => setVehicleDialog(null)}>닫기</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

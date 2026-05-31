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
import LinearProgress from '@mui/material/LinearProgress';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';

interface AtrUnit {
  id: string;
  complex_id: string;
  unit_code: string;
  status: string;
  battery_level: number;
  firmware_version: string;
  last_heartbeat: string;
  model: string;
  manufacturer: string;
  commissioned_at: string | null;
  location_zone: string;
  max_payload_kg: number;
  operating_mode: string;
  maintenance_interval_days: number;
  completeness_score: number;
  total_cycles: number;
}

interface Complex { id: string; name: string; }

const STEPS = ['장비 식별', '사양 및 운영', '단지 연동', '확인'];

interface FormData {
  unit_code: string;
  model: string;
  manufacturer: string;
  firmware_version: string;
  status: string;
  battery_level: string;
  max_payload_kg: string;
  operating_mode: string;
  location_zone: string;
  maintenance_interval_days: string;
  commissioned_at: string;
  complex_id: string;
}

const emptyForm: FormData = {
  unit_code: '', model: 'SG-ATR-200', manufacturer: 'SkyGarage', firmware_version: '1.0.0',
  status: 'offline', battery_level: '100', max_payload_kg: '2500', operating_mode: 'direct',
  location_zone: '', maintenance_interval_days: '90', commissioned_at: '', complex_id: '',
};

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = { online: 'success', idle: 'success', transporting: 'success', charging: 'warning', offline: 'error', maintenance: 'warning' };

function calcCompleteness(form: FormData): number {
  const fields = [form.unit_code, form.model, form.manufacturer, form.firmware_version, form.complex_id, form.location_zone, form.commissioned_at, form.operating_mode];
  const filled = fields.filter(f => !!f).length;
  return Math.round((filled / fields.length) * 100);
}

export default function AtrManagement() {
  useDocumentTitle('ATR 장비 관리');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<AtrUnit[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AtrUnit | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AtrUnit | null>(null);

  const completeness = useMemo(() => calcCompleteness(form), [form]);

  const loadData = useCallback(async () => {
    const [uRes, cRes] = await Promise.all([
      supabase.from('atr_units').select('*').order('unit_code'),
      supabase.from('complexes').select('id, name'),
    ]);
    if (uRes.data) setUnits(uRes.data);
    if (cRes.data) setComplexes(cRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('atr-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atr_units' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        unit_code: form.unit_code,
        model: form.model,
        manufacturer: form.manufacturer,
        firmware_version: form.firmware_version,
        status: form.status,
        battery_level: parseInt(form.battery_level) || 100,
        max_payload_kg: parseInt(form.max_payload_kg) || 2500,
        operating_mode: form.operating_mode,
        location_zone: form.location_zone,
        maintenance_interval_days: parseInt(form.maintenance_interval_days) || 90,
        commissioned_at: form.commissioned_at || null,
        complex_id: form.complex_id || null,
        completeness_score: completeness,
      };

      if (editing) {
        const { error } = await supabase.from('atr_units').update(payload).eq('id', editing.id);
        if (error) { showToast('수정 실패: ' + error.message, 'error'); return; }
        logAction('UPDATE', 'atr_units', editing.id, { unit_code: payload.unit_code });
        showToast('ATR 장비가 수정되었습니다.', 'success');
      } else {
        const { error } = await supabase.from('atr_units').insert(payload);
        if (error) { showToast('등록 실패: ' + error.message, 'error'); return; }
        logAction('CREATE', 'atr_units', undefined, { unit_code: payload.unit_code });
        showToast('ATR 장비가 등록되었습니다.', 'success');
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
    const { error } = await supabase.from('atr_units').delete().eq('id', deleteTarget.id);
    if (error) { showToast('삭제 실패', 'error'); return; }
    logAction('DELETE', 'atr_units', deleteTarget.id, { unit_code: deleteTarget.unit_code });
    showToast('삭제 완료', 'success');
    setDeleteTarget(null);
    loadData();
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setActiveStep(0); setDialogOpen(true); };
  const openEdit = (u: AtrUnit) => {
    setEditing(u);
    setForm({
      unit_code: u.unit_code, model: u.model || '', manufacturer: u.manufacturer || 'SkyGarage',
      firmware_version: u.firmware_version || '', status: u.status, battery_level: String(u.battery_level),
      max_payload_kg: String(u.max_payload_kg || 2500), operating_mode: u.operating_mode || 'direct',
      location_zone: u.location_zone || '', maintenance_interval_days: String(u.maintenance_interval_days || 90),
      commissioned_at: u.commissioned_at?.slice(0, 10) || '', complex_id: u.complex_id || '',
    });
    setActiveStep(0);
    setDialogOpen(true);
  };

  const batteryColor = (level: number) => level > 50 ? 'success' : level > 20 ? 'warning' : 'error';
  const complexName = (id: string) => complexes.find(c => c.id === id)?.name || '-';
  const onlineCount = units.filter(u => ['online', 'idle', 'transporting', 'charging'].includes(u.status)).length;

  if (loading) return <Box>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rectangular" height={48} sx={{ mb: 1, borderRadius: 1 }} />)}</Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>ATR 장비 관리</Typography>
          <Typography variant="body2" color="text.secondary">자동 이송 로봇 등록 및 모니터링</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/complexes')}>단지 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/parking')}>주차 운영</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/elevators')}>엘리베이터</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/maintenance')}>정비 관리</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>장비 등록</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">전체 장비</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{units.length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">가동중</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }} color="success.main">{onlineCount}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">가동률</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{units.length > 0 ? Math.round((onlineCount / units.length) * 100) : 0}%</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">총 사이클</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{units.reduce((s, u) => s + (u.total_cycles || 0), 0).toLocaleString()}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>장비코드</TableCell>
              <TableCell>모델</TableCell>
              <TableCell>단지</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>배터리</TableCell>
              <TableCell>모드</TableCell>
              <TableCell align="center">완성도</TableCell>
              <TableCell align="center">관리</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {units.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center"><Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>등록된 ATR 장비가 없습니다</Typography></TableCell></TableRow>
              ) : units.map(u => (
                <TableRow key={u.id} hover>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.75rem' }}>{u.unit_code}</Typography></TableCell>
                  <TableCell><Typography variant="caption">{u.model || '-'}</Typography></TableCell>
                  <TableCell><Typography variant="caption">{complexName(u.complex_id)}</Typography></TableCell>
                  <TableCell><Chip label={u.status} size="small" color={statusColors[u.status] || 'default'} /></TableCell>
                  <TableCell sx={{ minWidth: 100 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LinearProgress variant="determinate" value={u.battery_level || 0} color={batteryColor(u.battery_level)} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
                      <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{u.battery_level}%</Typography>
                    </Box>
                  </TableCell>
                  <TableCell><Chip label={u.operating_mode || 'direct'} size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} /></TableCell>
                  <TableCell align="center">
                    {(u.completeness_score || 0) >= 80
                      ? <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                      : <WarningIcon sx={{ fontSize: 14, color: 'warning.main' }} />}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => openEdit(u)}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton size="small" onClick={() => setDeleteTarget(u)} sx={{ color: 'error.main' }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
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
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{editing ? 'ATR 장비 수정' : 'ATR 장비 등록'}</Typography>
          <Typography variant="caption" color="text.secondary">체계적 장비 등록 및 단지 연동</Typography>
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
                <TextField label="장비 코드 *" value={form.unit_code} onChange={e => setForm({ ...form, unit_code: e.target.value })} fullWidth size="small" placeholder="ATR-001" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="모델명" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} fullWidth size="small" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="제조사" value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} fullWidth size="small" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="펌웨어 버전" value={form.firmware_version} onChange={e => setForm({ ...form, firmware_version: e.target.value })} fullWidth size="small" />
              </Grid>
            </Grid>
          )}

          {activeStep === 1 && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="운영 모드" select value={form.operating_mode} onChange={e => setForm({ ...form, operating_mode: e.target.value })} fullWidth size="small">
                  <MenuItem value="direct">직입형 (Direct)</MenuItem>
                  <MenuItem value="valet">발렛형 (Valet)</MenuItem>
                  <MenuItem value="tower">타워형 (Tower)</MenuItem>
                  <MenuItem value="hybrid">하이브리드</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="최대 적재량 (kg)" type="number" value={form.max_payload_kg} onChange={e => setForm({ ...form, max_payload_kg: e.target.value })} fullWidth size="small" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="상태" select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} fullWidth size="small">
                  <MenuItem value="online">Online</MenuItem>
                  <MenuItem value="idle">Idle</MenuItem>
                  <MenuItem value="offline">Offline</MenuItem>
                  <MenuItem value="maintenance">Maintenance</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="정비 주기 (일)" type="number" value={form.maintenance_interval_days} onChange={e => setForm({ ...form, maintenance_interval_days: e.target.value })} fullWidth size="small" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="투입일" type="date" value={form.commissioned_at} onChange={e => setForm({ ...form, commissioned_at: e.target.value })} fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="배터리 잔량 (%)" type="number" value={form.battery_level} onChange={e => setForm({ ...form, battery_level: e.target.value })} fullWidth size="small" />
              </Grid>
            </Grid>
          )}

          {activeStep === 2 && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <TextField label="배치 단지 *" select value={form.complex_id} onChange={e => setForm({ ...form, complex_id: e.target.value })} fullWidth size="small">
                  <MenuItem value="">선택하세요</MenuItem>
                  {complexes.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField label="배치 구역" value={form.location_zone} onChange={e => setForm({ ...form, location_zone: e.target.value })} fullWidth size="small" placeholder="B1 주차장 A구역" />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
                  장비를 단지에 연동하면 해당 단지의 주차 운영, 엘리베이터 스케줄링과 자동으로 연계됩니다.
                </Alert>
              </Grid>
            </Grid>
          )}

          {activeStep === 3 && (
            <Card variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700 }}>등록 확인</Typography>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">장비코드</Typography><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{form.unit_code}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">모델</Typography><Typography variant="body2">{form.model}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">제조사</Typography><Typography variant="body2">{form.manufacturer}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">운영 모드</Typography><Typography variant="body2">{form.operating_mode}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">단지</Typography><Typography variant="body2">{complexName(form.complex_id)}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">구역</Typography><Typography variant="body2">{form.location_zone || '-'}</Typography></Grid>
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
              <Button variant="contained" onClick={() => setActiveStep(s => s + 1)} disabled={activeStep === 0 && !form.unit_code}>다음</Button>
            ) : (
              <Button variant="contained" onClick={handleSave} disabled={saving || !form.unit_code}>{saving ? '저장 중...' : editing ? '수정' : '등록'}</Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>장비 삭제</DialogTitle>
        <DialogContent><Typography>"{deleteTarget?.unit_code}" 장비를 삭제하시겠습니까?</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDeleteTarget(null)}>취소</Button><Button variant="contained" color="error" onClick={handleDelete}>삭제</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

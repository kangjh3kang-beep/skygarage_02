import { useState, useEffect, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
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
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningIcon from '@mui/icons-material/Warning';
import DescriptionIcon from '@mui/icons-material/Description';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useNavigate } from 'react-router-dom';

interface Contract {
  id: string;
  contract_code: string;
  title: string;
  partner_id: string;
  complex_id: string;
  status: string;
  start_date: string;
  end_date: string;
  value: number;
  progress: number;
  payment_terms: string;
  renewal_notice_days: number;
  currency: string;
  scope_description: string;
  completeness_score: number;
  created_at: string;
}

interface Complex {
  id: string;
  name: string;
  mdm_code: string;
}

interface Partner {
  id: string;
  name: string;
  registration_code: string;
}

interface FormData {
  title: string;
  partner_id: string;
  complex_id: string;
  status: string;
  start_date: string;
  end_date: string;
  value: string;
  progress: string;
  payment_terms: string;
  renewal_notice_days: string;
  currency: string;
  scope_description: string;
}

const emptyForm: FormData = {
  title: '',
  partner_id: '',
  complex_id: '',
  status: 'draft',
  start_date: '',
  end_date: '',
  value: '0',
  progress: '0',
  payment_terms: '',
  renewal_notice_days: '30',
  currency: 'KRW',
  scope_description: '',
};

const steps = ['기본 정보', '계약 조건', '연동 설정', '확인'];

function calcCompleteness(form: FormData): number {
  const fields = [
    form.title,
    form.status,
    form.start_date,
    form.end_date,
    Number(form.value) > 0 ? 'y' : '',
    form.partner_id,
    form.complex_id,
    form.payment_terms,
    form.scope_description,
    form.currency,
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

export default function ContractManagement() {
  useDocumentTitle('계약 관리');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [generatedCode, setGeneratedCode] = useState('');

  const loadData = useCallback(async () => {
    const [contractRes, complexRes, partnerRes] = await Promise.all([
      supabase.from('contracts').select('*').order('created_at', { ascending: false }),
      supabase.from('complexes').select('id, name, mdm_code').order('name'),
      supabase.from('partners').select('id, name, registration_code').order('name'),
    ]);
    if (contractRes.data) setContracts(contractRes.data);
    if (complexRes.data) setComplexes(complexRes.data);
    if (partnerRes.data) setPartners(partnerRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('contracts-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const handleOpenAdd = async () => {
    setEditing(null);
    setForm(emptyForm);
    setActiveStep(0);
    const { data } = await supabase.rpc('generate_entity_code', { prefix: 'CTR', entity_type: 'contract' });
    setGeneratedCode(data || '');
    setDialogOpen(true);
  };

  const handleOpenEdit = (c: Contract) => {
    setEditing(c);
    setGeneratedCode(c.contract_code || '');
    setForm({
      title: c.title || '',
      partner_id: c.partner_id || '',
      complex_id: c.complex_id || '',
      status: c.status || 'draft',
      start_date: c.start_date || '',
      end_date: c.end_date || '',
      value: String(c.value || 0),
      progress: String(c.progress || 0),
      payment_terms: c.payment_terms || '',
      renewal_notice_days: String(c.renewal_notice_days || 30),
      currency: c.currency || 'KRW',
      scope_description: c.scope_description || '',
    });
    setActiveStep(0);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const completeness = calcCompleteness(form);
    const payload = {
      contract_code: generatedCode,
      title: form.title,
      partner_id: form.partner_id || null,
      complex_id: form.complex_id || null,
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      value: parseFloat(form.value) || 0,
      progress: parseInt(form.progress) || 0,
      payment_terms: form.payment_terms || null,
      renewal_notice_days: parseInt(form.renewal_notice_days) || 30,
      currency: form.currency || 'KRW',
      scope_description: form.scope_description || null,
      completeness_score: completeness,
    };
    if (editing) {
      const { error } = await supabase.from('contracts').update(payload).eq('id', editing.id);
      if (error) { showToast('수정 실패: ' + error.message, 'error'); return; }
      logAction('UPDATE', 'contracts', editing.id, { title: payload.title });
      showToast('계약이 수정되었습니다.', 'success');
    } else {
      const { error } = await supabase.from('contracts').insert(payload);
      if (error) { showToast('등록 실패: ' + error.message, 'error'); return; }
      logAction('CREATE', 'contracts', undefined, { title: payload.title, code: generatedCode });
      showToast('계약이 등록되었습니다.', 'success');
    }
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('contracts').delete().eq('id', deleteTarget.id);
    if (error) { showToast('삭제 실패', 'error'); return; }
    logAction('DELETE', 'contracts', deleteTarget.id, { title: deleteTarget.title });
    showToast('삭제 완료', 'success');
    setDeleteTarget(null);
    loadData();
  };

  const isExpiringSoon = (endDate: string) => {
    if (!endDate) return false;
    const diff = new Date(endDate).getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  };

  const statusColors: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error'> = { draft: 'default', active: 'success', completed: 'primary', expired: 'error', cancelled: 'warning' };
  const statusLabels: Record<string, string> = { draft: '초안', active: '진행중', completed: '완료', expired: '만료', cancelled: '취소' };

  const totalValue = useMemo(() => contracts.reduce((s, c) => s + (c.value || 0), 0), [contracts]);
  const activeCount = contracts.filter(c => c.status === 'active').length;
  const avgCompleteness = useMemo(() => {
    if (contracts.length === 0) return 0;
    return Math.round(contracts.reduce((s, c) => s + (c.completeness_score || 0), 0) / contracts.length);
  }, [contracts]);
  const expiringSoonCount = contracts.filter(c => isExpiringSoon(c.end_date)).length;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">계약 관리</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/crm')}>CRM</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/partners')}>파트너</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>계약 등록</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <DescriptionIcon color="primary" />
            <Typography variant="caption" color="text.secondary">전체 계약</Typography>
            <Typography variant="h2">{contracts.length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <TrendingUpIcon sx={{ color: '#2e7d32' }} />
            <Typography variant="caption" color="text.secondary">진행중</Typography>
            <Typography variant="h2" color="success.main">{activeCount}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <AttachMoneyIcon sx={{ color: '#0288d1' }} />
            <Typography variant="caption" color="text.secondary">총 계약액</Typography>
            <Typography variant="h2">{(totalValue / 1000000).toFixed(0)}M</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <AssignmentTurnedInIcon sx={{ color: '#ed6c02' }} />
            <Typography variant="caption" color="text.secondary">데이터 완성도</Typography>
            <Typography variant="h2">{avgCompleteness}%</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      {expiringSoonCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
          {expiringSoonCount}건의 계약이 30일 이내 만료 예정입니다.
        </Alert>
      )}

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>계약코드</TableCell>
              <TableCell>계약명</TableCell>
              <TableCell>파트너</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>기간</TableCell>
              <TableCell align="right">금액</TableCell>
              <TableCell>진행률</TableCell>
              <TableCell>완성도</TableCell>
              <TableCell align="center">관리</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {contracts.map(c => {
                const partner = partners.find(p => p.id === c.partner_id);
                return (
                  <TableRow key={c.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'primary.main' }}>
                        {c.contract_code || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.title}</Typography>
                      {isExpiringSoon(c.end_date) && <Chip icon={<WarningIcon />} label="만료임박" size="small" color="warning" sx={{ ml: 1 }} />}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{partner?.name || '-'}</Typography>
                    </TableCell>
                    <TableCell><Chip label={statusLabels[c.status] || c.status} size="small" color={statusColors[c.status] || 'default'} /></TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {c.start_date ? new Date(c.start_date).toLocaleDateString('ko-KR') : '-'}
                        {' ~ '}
                        {c.end_date ? new Date(c.end_date).toLocaleDateString('ko-KR') : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{c.value ? `${c.value.toLocaleString()}원` : '-'}</TableCell>
                    <TableCell sx={{ minWidth: 100 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress variant="determinate" value={c.progress || 0} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
                        <Typography variant="caption">{c.progress || 0}%</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${c.completeness_score || 0}%`}
                        size="small"
                        color={(c.completeness_score || 0) >= 80 ? 'success' : (c.completeness_score || 0) >= 50 ? 'warning' : 'error'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleOpenEdit(c)}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                      <IconButton size="small" onClick={() => setDeleteTarget(c)} sx={{ color: 'error.main' }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {contracts.length === 0 && (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">등록된 계약이 없습니다.</Typography>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Stepper Registration Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? '계약 수정' : '계약 등록'}</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} sx={{ my: 2 }}>
            {steps.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>

          {activeStep === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              {generatedCode && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  계약 코드: <strong>{generatedCode}</strong>
                </Alert>
              )}
              <TextField label="계약명" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} fullWidth size="small" required />
              <TextField label="상태" select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} fullWidth size="small">
                <MenuItem value="draft">초안</MenuItem>
                <MenuItem value="active">진행중</MenuItem>
                <MenuItem value="completed">완료</MenuItem>
                <MenuItem value="expired">만료</MenuItem>
                <MenuItem value="cancelled">취소</MenuItem>
              </TextField>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField label="시작일" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField label="종료일" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} />
                </Grid>
              </Grid>
            </Box>
          )}

          {activeStep === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField label="계약 금액" type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} fullWidth size="small" />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField label="통화" select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} fullWidth size="small">
                    <MenuItem value="KRW">KRW (원)</MenuItem>
                    <MenuItem value="USD">USD ($)</MenuItem>
                    <MenuItem value="EUR">EUR</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
              <TextField label="결제 조건" value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })} fullWidth size="small" placeholder="예: 월납, 분기납, 선불 등" />
              <TextField label="갱신 통보 기간 (일)" type="number" value={form.renewal_notice_days} onChange={e => setForm({ ...form, renewal_notice_days: e.target.value })} fullWidth size="small" />
              <TextField label="계약 범위 설명" value={form.scope_description} onChange={e => setForm({ ...form, scope_description: e.target.value })} fullWidth size="small" multiline rows={3} />
              <TextField label="진행률 (%)" type="number" value={form.progress} onChange={e => setForm({ ...form, progress: e.target.value })} fullWidth size="small" slotProps={{ input: { inputProps: { min: 0, max: 100 } } }} />
            </Box>
          )}

          {activeStep === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField label="연결 단지" select value={form.complex_id} onChange={e => setForm({ ...form, complex_id: e.target.value })} fullWidth size="small">
                <MenuItem value="">미지정</MenuItem>
                {complexes.map(cx => (
                  <MenuItem key={cx.id} value={cx.id}>
                    {cx.mdm_code ? `[${cx.mdm_code}] ` : ''}{cx.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="연결 파트너" select value={form.partner_id} onChange={e => setForm({ ...form, partner_id: e.target.value })} fullWidth size="small">
                <MenuItem value="">미지정</MenuItem>
                {partners.map(p => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.registration_code ? `[${p.registration_code}] ` : ''}{p.name}
                  </MenuItem>
                ))}
              </TextField>
              <Alert severity="info">
                단지 및 파트너를 연결하면 관련 인보이스, 유지보수 일정이 자동으로 연동됩니다.
              </Alert>
            </Box>
          )}

          {activeStep === 3 && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                데이터 완성도: <strong>{calcCompleteness(form)}%</strong>
              </Alert>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <Typography variant="body2"><strong>계약코드:</strong> {generatedCode}</Typography>
                <Typography variant="body2"><strong>상태:</strong> {statusLabels[form.status] || form.status}</Typography>
                <Typography variant="body2"><strong>계약명:</strong> {form.title}</Typography>
                <Typography variant="body2"><strong>금액:</strong> {Number(form.value).toLocaleString()} {form.currency}</Typography>
                <Typography variant="body2"><strong>기간:</strong> {form.start_date || '-'} ~ {form.end_date || '-'}</Typography>
                <Typography variant="body2"><strong>결제조건:</strong> {form.payment_terms || '-'}</Typography>
                <Typography variant="body2"><strong>갱신통보:</strong> {form.renewal_notice_days}일 전</Typography>
                <Typography variant="body2"><strong>진행률:</strong> {form.progress}%</Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2"><strong>단지:</strong> {complexes.find(cx => cx.id === form.complex_id)?.name || '미지정'}</Typography>
              <Typography variant="body2"><strong>파트너:</strong> {partners.find(p => p.id === form.partner_id)?.name || '미지정'}</Typography>
              {form.scope_description && (
                <Typography variant="body2" sx={{ mt: 1 }}><strong>범위:</strong> {form.scope_description}</Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          <Box sx={{ flex: 1 }} />
          {activeStep > 0 && <Button onClick={() => setActiveStep(s => s - 1)}>이전</Button>}
          {activeStep < steps.length - 1 && (
            <Button variant="contained" onClick={() => setActiveStep(s => s + 1)} disabled={activeStep === 0 && !form.title}>
              다음
            </Button>
          )}
          {activeStep === steps.length - 1 && (
            <Button variant="contained" onClick={handleSave} disabled={!form.title}>
              {editing ? '수정' : '등록'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>계약 삭제</DialogTitle>
        <DialogContent><Typography>"{deleteTarget?.title}" 계약을 삭제하시겠습니까?</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDeleteTarget(null)}>취소</Button><Button variant="contained" color="error" onClick={handleDelete}>삭제</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

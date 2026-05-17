import { useState, useEffect, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
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
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import LinearProgress from '@mui/material/LinearProgress';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import GavelIcon from '@mui/icons-material/Gavel';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';

interface License {
  id: string;
  license_number: string;
  entity_code: string;
  patent_id: string;
  licensee_name: string;
  licensee_contact: string;
  licensee_email: string;
  license_type: string;
  territory: string;
  status: string;
  start_date: string;
  end_date: string;
  royalty_type: string;
  royalty_amount: number;
  royalty_currency: string;
  payment_frequency: string;
  total_revenue: number;
  contract_value: number;
  terms: string;
  notes: string;
  completeness_score: number;
  created_at: string;
}

interface Patent {
  id: string;
  title: string;
  patent_number: string;
}

const STEPS = ['기본 정보', '계약 조건', '로열티 설정', '확인'];

const STATUS_OPTIONS = [
  { value: 'negotiating', label: '협상중', color: 'warning' },
  { value: 'active', label: '활성', color: 'success' },
  { value: 'suspended', label: '정지', color: 'error' },
  { value: 'expired', label: '만료', color: 'default' },
  { value: 'terminated', label: '해지', color: 'error' },
] as const;

const TYPE_OPTIONS = [
  { value: 'exclusive', label: '전용실시권' },
  { value: 'non_exclusive', label: '통상실시권' },
  { value: 'cross_license', label: '크로스라이선스' },
  { value: 'sublicense', label: '재실시권' },
];

const ROYALTY_TYPE_OPTIONS = [
  { value: 'fixed', label: '정액' },
  { value: 'percentage', label: '정률(%)' },
  { value: 'milestone', label: '마일스톤' },
  { value: 'hybrid', label: '혼합' },
];

const PAYMENT_FREQ_OPTIONS = [
  { value: 'monthly', label: '월간' },
  { value: 'quarterly', label: '분기' },
  { value: 'annually', label: '연간' },
  { value: 'one_time', label: '일시불' },
];

const TERRITORY_OPTIONS = [
  { value: 'KR', label: '대한민국' },
  { value: 'US', label: '미국' },
  { value: 'JP', label: '일본' },
  { value: 'CN', label: '중국' },
  { value: 'EU', label: '유럽' },
  { value: 'GLOBAL', label: '전세계' },
  { value: 'ASIA', label: '아시아' },
];

const emptyForm = {
  patent_id: '', licensee_name: '', licensee_contact: '',
  licensee_email: '', license_type: 'exclusive', territory: 'KR',
  status: 'negotiating', start_date: '', end_date: '',
  royalty_type: 'fixed', royalty_amount: '0', royalty_currency: 'KRW',
  payment_frequency: 'monthly', contract_value: '0', terms: '', notes: '',
};

function calcCompleteness(form: typeof emptyForm): number {
  const fields = [
    { val: form.licensee_name, w: 15 },
    { val: form.patent_id, w: 15 },
    { val: form.licensee_email, w: 10 },
    { val: form.licensee_contact, w: 5 },
    { val: form.start_date, w: 10 },
    { val: form.end_date, w: 10 },
    { val: form.territory, w: 5 },
    { val: form.royalty_type, w: 5 },
    { val: form.royalty_amount !== '0' ? form.royalty_amount : '', w: 10 },
    { val: form.contract_value !== '0' ? form.contract_value : '', w: 10 },
    { val: form.terms, w: 5 },
  ];
  return fields.reduce((sum, f) => sum + (f.val ? f.w : 0), 0);
}

export default function LicenseManagement() {
  useDocumentTitle('라이선스 관리');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [patents, setPatents] = useState<Patent[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<License | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeStep, setActiveStep] = useState(0);
  const [generatedCode, setGeneratedCode] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<License | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const completeness = useMemo(() => calcCompleteness(form), [form]);

  const loadData = useCallback(async () => {
    const [licRes, patRes] = await Promise.all([
      supabase.from('licenses').select('*').order('created_at', { ascending: false }),
      supabase.from('patents').select('id, title, patent_number'),
    ]);
    if (licRes.data) setLicenses(licRes.data);
    if (patRes.data) setPatents(patRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('licenses-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licenses' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const openCreate = async () => {
    setEditing(null);
    setForm(emptyForm);
    setActiveStep(0);
    setGeneratedCode('');
    setDialogOpen(true);
    const { data } = await supabase.rpc('generate_entity_code', { prefix: 'LIC' });
    if (data) setGeneratedCode(data);
  };

  const openEdit = (license: License) => {
    setEditing(license);
    setGeneratedCode(license.entity_code || license.license_number || '');
    setForm({
      patent_id: license.patent_id || '',
      licensee_name: license.licensee_name,
      licensee_contact: license.licensee_contact || '',
      licensee_email: license.licensee_email || '',
      license_type: license.license_type,
      territory: license.territory || 'KR',
      status: license.status,
      start_date: license.start_date || '',
      end_date: license.end_date || '',
      royalty_type: license.royalty_type || 'fixed',
      royalty_amount: String(license.royalty_amount || 0),
      royalty_currency: license.royalty_currency || 'KRW',
      payment_frequency: license.payment_frequency || 'monthly',
      contract_value: String(license.contract_value || 0),
      terms: license.terms || '',
      notes: license.notes || '',
    });
    setActiveStep(0);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      license_number: generatedCode || null,
      entity_code: generatedCode || null,
      patent_id: form.patent_id || null,
      licensee_name: form.licensee_name,
      licensee_contact: form.licensee_contact,
      licensee_email: form.licensee_email,
      license_type: form.license_type,
      territory: form.territory,
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      royalty_type: form.royalty_type,
      royalty_amount: parseFloat(form.royalty_amount) || 0,
      royalty_currency: form.royalty_currency,
      payment_frequency: form.payment_frequency,
      contract_value: parseFloat(form.contract_value) || 0,
      terms: form.terms,
      notes: form.notes,
      completeness_score: completeness,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      const { error } = await supabase.from('licenses').update(payload).eq('id', editing.id);
      if (error) { showToast('수정 실패: ' + error.message, 'error'); return; }
      logAction('UPDATE', 'licenses', editing.id, { licensee: payload.licensee_name });
      showToast('라이선스가 수정되었습니다.', 'success');
    } else {
      const { error } = await supabase.from('licenses').insert(payload);
      if (error) { showToast('등록 실패: ' + error.message, 'error'); return; }
      logAction('CREATE', 'licenses', undefined, { licensee: payload.licensee_name });
      showToast('라이선스가 등록되었습니다.', 'success');
    }
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('licenses').delete().eq('id', deleteTarget.id);
    if (error) { showToast('삭제 실패', 'error'); return; }
    logAction('DELETE', 'licenses', deleteTarget.id, { licensee: deleteTarget.licensee_name });
    showToast('삭제 완료', 'success');
    setDeleteTarget(null);
    loadData();
  };

  const getStatusChip = (status: string) => {
    const opt = STATUS_OPTIONS.find(s => s.value === status);
    return <Chip label={opt?.label || status} color={opt?.color as 'default'} size="small" />;
  };

  const getPatentTitle = (patentId: string) => patents.find(p => p.id === patentId)?.title || '-';

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'KRW') return `${amount.toLocaleString()}원`;
    return `${currency} ${amount.toLocaleString()}`;
  };

  const filtered = licenses.filter(l => {
    const matchSearch = !search || l.licensee_name.toLowerCase().includes(search.toLowerCase()) ||
      (l.license_number || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: licenses.length,
    active: licenses.filter(l => l.status === 'active').length,
    negotiating: licenses.filter(l => l.status === 'negotiating').length,
    totalRevenue: licenses.reduce((sum, l) => sum + (l.total_revenue || 0), 0),
    avgCompleteness: licenses.length > 0 ? Math.round(licenses.reduce((s, l) => s + (l.completeness_score || 0), 0) / licenses.length) : 0,
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">엔티티 코드</Typography>
              <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{generatedCode || '생성 중...'}</Typography>
            </Box>
            <TextField fullWidth label="라이선시 (회사명) *" value={form.licensee_name} onChange={e => setForm({ ...form, licensee_name: e.target.value })} size="small" />
            <TextField fullWidth label="담당자" value={form.licensee_contact} onChange={e => setForm({ ...form, licensee_contact: e.target.value })} size="small" />
            <TextField fullWidth label="이메일" value={form.licensee_email} onChange={e => setForm({ ...form, licensee_email: e.target.value })} size="small" />
            <TextField fullWidth select label="대상 특허" value={form.patent_id} onChange={e => setForm({ ...form, patent_id: e.target.value })} size="small">
              <MenuItem value="">선택 안함</MenuItem>
              {patents.map(p => <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>)}
            </TextField>
            <TextField fullWidth select label="상태" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} size="small">
              {STATUS_OPTIONS.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </TextField>
          </Box>
        );
      case 1:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField fullWidth select label="라이선스 유형" value={form.license_type} onChange={e => setForm({ ...form, license_type: e.target.value })} size="small">
              {TYPE_OPTIONS.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <TextField fullWidth select label="지역" value={form.territory} onChange={e => setForm({ ...form, territory: e.target.value })} size="small">
              {TERRITORY_OPTIONS.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}><TextField fullWidth type="date" label="시작일" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} size="small" slotProps={{ inputLabel: { shrink: true } }} /></Grid>
              <Grid size={{ xs: 6 }}><TextField fullWidth type="date" label="종료일" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} size="small" slotProps={{ inputLabel: { shrink: true } }} /></Grid>
            </Grid>
            <TextField fullWidth label="계약 총액" type="number" value={form.contract_value} onChange={e => setForm({ ...form, contract_value: e.target.value })} size="small" />
            <TextField fullWidth multiline rows={2} label="계약 조건 요약" value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} size="small" />
          </Box>
        );
      case 2:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField fullWidth select label="로열티 유형" value={form.royalty_type} onChange={e => setForm({ ...form, royalty_type: e.target.value })} size="small">
              {ROYALTY_TYPE_OPTIONS.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </TextField>
            <TextField fullWidth label="로열티 금액" type="number" value={form.royalty_amount} onChange={e => setForm({ ...form, royalty_amount: e.target.value })} size="small" />
            <TextField fullWidth select label="지급 주기" value={form.payment_frequency} onChange={e => setForm({ ...form, payment_frequency: e.target.value })} size="small">
              {PAYMENT_FREQ_OPTIONS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
            </TextField>
            <TextField fullWidth multiline rows={2} label="내부 메모" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} size="small" />
          </Box>
        );
      case 3:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2">등록 정보 확인</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="caption" color="text.secondary">완성도</Typography>
              <LinearProgress variant="determinate" value={completeness} sx={{ flex: 1, height: 8, borderRadius: 1 }} color={completeness >= 80 ? 'success' : completeness >= 50 ? 'warning' : 'error'} />
              <Typography variant="caption" sx={{ fontWeight: 700 }}>{completeness}%</Typography>
            </Box>
            <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2 }}>
              <Grid container spacing={1}>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">코드</Typography><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{generatedCode}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">라이선시</Typography><Typography variant="body2">{form.licensee_name || '-'}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">특허</Typography><Typography variant="body2">{getPatentTitle(form.patent_id)}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">유형</Typography><Typography variant="body2">{TYPE_OPTIONS.find(t => t.value === form.license_type)?.label}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">지역</Typography><Typography variant="body2">{TERRITORY_OPTIONS.find(t => t.value === form.territory)?.label}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">계약 총액</Typography><Typography variant="body2">{formatCurrency(parseFloat(form.contract_value) || 0, form.royalty_currency)}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">기간</Typography><Typography variant="body2">{form.start_date || '-'} ~ {form.end_date || '-'}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">로열티</Typography><Typography variant="body2">{ROYALTY_TYPE_OPTIONS.find(r => r.value === form.royalty_type)?.label} / {formatCurrency(parseFloat(form.royalty_amount) || 0, form.royalty_currency)}</Typography></Grid>
              </Grid>
            </Box>
          </Box>
        );
      default: return null;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>라이선스 관리</Typography>
          <Typography variant="body2" color="text.secondary">License & Royalty Management</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/ai-management')}>AI 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/workflows')}>워크플로우</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/patents')}>특허 관리</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>라이선스 등록</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: '전체 라이선스', value: String(stats.total), color: 'text.primary' },
          { label: '활성 계약', value: String(stats.active), color: 'success.main' },
          { label: '협상중', value: String(stats.negotiating), color: 'warning.main' },
          { label: '누적 수익', value: formatCurrency(stats.totalRevenue, 'KRW'), color: 'info.main' },
          { label: '평균 완성도', value: `${stats.avgCompleteness}%`, color: stats.avgCompleteness >= 80 ? 'success.main' : stats.avgCompleteness >= 50 ? 'warning.main' : 'error.main' },
        ].map(s => (
          <Grid size={{ xs: 6, md: 2.4 }} key={s.label}>
            <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: s.color }}>{s.value}</Typography>
              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ mb: 2, p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small" placeholder="라이선시, 번호 검색..." value={search}
            onChange={e => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            sx={{ minWidth: 240 }}
          />
          <Tabs value={statusFilter} onChange={(_, v) => setStatusFilter(v)} variant="scrollable" scrollButtons="auto">
            <Tab label="전체" value="all" />
            {STATUS_OPTIONS.map(s => <Tab key={s.value} label={s.label} value={s.value} />)}
          </Tabs>
        </Box>
      </Card>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>코드</TableCell>
                <TableCell>라이선시</TableCell>
                <TableCell>대상 특허</TableCell>
                <TableCell>유형</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>로열티</TableCell>
                <TableCell>완성도</TableCell>
                <TableCell align="right">관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                    <GavelIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">등록된 라이선스가 없습니다.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(license => {
                const cs = license.completeness_score || 0;
                return (
                  <TableRow key={license.id} hover>
                    <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{license.entity_code || license.license_number || '-'}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{license.licensee_name}</Typography>
                      {license.licensee_email && <Typography variant="caption" color="text.secondary">{license.licensee_email}</Typography>}
                    </TableCell>
                    <TableCell><Typography variant="caption">{getPatentTitle(license.patent_id)}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{TYPE_OPTIONS.find(t => t.value === license.license_type)?.label || license.license_type}</Typography></TableCell>
                    <TableCell>{getStatusChip(license.status)}</TableCell>
                    <TableCell><Typography variant="caption">{formatCurrency(license.royalty_amount, license.royalty_currency)}</Typography></TableCell>
                    <TableCell><Chip label={`${cs}%`} size="small" color={cs >= 80 ? 'success' : cs >= 50 ? 'warning' : 'error'} variant="outlined" /></TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(license)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(license)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? '라이선스 수정' : '라이선스 등록'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
            {STEPS.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <LinearProgress variant="determinate" value={completeness} sx={{ flex: 1, height: 6, borderRadius: 1 }} color={completeness >= 80 ? 'success' : completeness >= 50 ? 'warning' : 'error'} />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>{completeness}%</Typography>
          </Box>
          {renderStep()}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          {activeStep > 0 && <Button onClick={() => setActiveStep(s => s - 1)}>이전</Button>}
          {activeStep < STEPS.length - 1 ? (
            <Button variant="contained" onClick={() => setActiveStep(s => s + 1)} disabled={activeStep === 0 && !form.licensee_name}>다음</Button>
          ) : (
            <Button variant="contained" onClick={handleSave} disabled={!form.licensee_name}>{editing ? '수정' : '등록'}</Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>라이선스 삭제</DialogTitle>
        <DialogContent><Typography>"{deleteTarget?.licensee_name}" 라이선스를 삭제하시겠습니까?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>취소</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>삭제</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

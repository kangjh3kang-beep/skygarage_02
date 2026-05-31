import { useState, useEffect, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
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
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import HandshakeIcon from '@mui/icons-material/Handshake';
import LinkIcon from '@mui/icons-material/Link';
import ScoreIcon from '@mui/icons-material/Score';
import CategoryIcon from '@mui/icons-material/Category';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';

interface Partner {
  id: string;
  name: string;
  registration_code: string;
  category: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  contract_id: string;
  sla_score: number;
  integration_status: string;
  last_activity_at: string;
  business_number: string;
  address: string;
  website: string;
  tier: string;
  completeness_score: number;
  created_at: string;
}

interface FormData {
  name: string;
  category: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  contract_id: string;
  sla_score: string;
  integration_status: string;
  business_number: string;
  address: string;
  website: string;
  tier: string;
}

const categories = ['유지보수', '보안', '청소', '조경', '엘리베이터', '주차', '에너지', '기타'];
const tiers = ['platinum', 'gold', 'silver', 'bronze'];
const tierLabels: Record<string, string> = { platinum: '플래티넘', gold: '골드', silver: '실버', bronze: '브론즈' };
const tierColors: Record<string, string> = { platinum: '#607d8b', gold: '#f9a825', silver: '#90a4ae', bronze: '#8d6e63' };

const integrationStatuses = ['connected', 'pending', 'disconnected'];
const integrationLabels: Record<string, string> = { connected: '연결됨', pending: '대기중', disconnected: '연결끊김' };
const integrationColors: Record<string, 'success' | 'warning' | 'error'> = { connected: 'success', pending: 'warning', disconnected: 'error' };

const steps = ['기본 정보', '사업자 정보', '연동 설정', '확인'];

const emptyForm: FormData = {
  name: '',
  category: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  contract_id: '',
  sla_score: '',
  integration_status: 'pending',
  business_number: '',
  address: '',
  website: '',
  tier: 'silver',
};

function calcCompleteness(form: FormData): number {
  const fields = [
    form.name,
    form.category,
    form.contact_name,
    form.contact_email,
    form.contact_phone,
    form.business_number,
    form.address,
    form.tier,
    form.integration_status,
    form.sla_score,
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

export default function PartnerManagement() {
  useDocumentTitle('파트너 관리');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [generatedCode, setGeneratedCode] = useState('');

  const loadData = useCallback(async () => {
    let query = supabase.from('partners').select('*').order('name');
    if (categoryFilter !== 'all') query = query.eq('category', categoryFilter);
    if (statusFilter !== 'all') query = query.eq('integration_status', statusFilter);
    const { data } = await query;
    if (data) setPartners(data);
    setLoading(false);
  }, [categoryFilter, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('partners-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partners' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const handleOpenAdd = async () => {
    setEditing(null);
    setForm(emptyForm);
    setActiveStep(0);
    const { data } = await supabase.rpc('generate_entity_code', { prefix: 'PTR', entity_type: 'partner' });
    setGeneratedCode(data || '');
    setDialogOpen(true);
  };

  const handleOpenEdit = (p: Partner) => {
    setEditing(p);
    setGeneratedCode(p.registration_code || '');
    setForm({
      name: p.name || '',
      category: p.category || '',
      contact_name: p.contact_name || '',
      contact_email: p.contact_email || '',
      contact_phone: p.contact_phone || '',
      contract_id: p.contract_id || '',
      sla_score: p.sla_score != null ? String(p.sla_score) : '',
      integration_status: p.integration_status || 'pending',
      business_number: p.business_number || '',
      address: p.address || '',
      website: p.website || '',
      tier: p.tier || 'silver',
    });
    setActiveStep(0);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const completeness = calcCompleteness(form);
    const payload = {
      registration_code: generatedCode,
      name: form.name,
      category: form.category,
      contact_name: form.contact_name,
      contact_email: form.contact_email,
      contact_phone: form.contact_phone,
      contract_id: form.contract_id || null,
      sla_score: form.sla_score ? Number(form.sla_score) : null,
      integration_status: form.integration_status,
      business_number: form.business_number || null,
      address: form.address || null,
      website: form.website || null,
      tier: form.tier || null,
      completeness_score: completeness,
    };
    if (editing) {
      const { error } = await supabase.from('partners').update(payload).eq('id', editing.id);
      if (error) { showToast('수정 실패: ' + error.message, 'error'); return; }
      logAction('UPDATE', 'partners', editing.id, { name: payload.name });
      showToast('파트너 정보가 수정되었습니다.', 'success');
    } else {
      const { error } = await supabase.from('partners').insert(payload);
      if (error) { showToast('등록 실패: ' + error.message, 'error'); return; }
      logAction('CREATE', 'partners', undefined, { name: payload.name, code: generatedCode });
      showToast('파트너가 등록되었습니다.', 'success');
    }
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('partners').delete().eq('id', deleteTarget.id);
    if (error) { showToast('삭제 실패', 'error'); return; }
    logAction('DELETE', 'partners', deleteTarget.id, { name: deleteTarget.name });
    showToast('삭제 완료', 'success');
    setDeleteTarget(null);
    loadData();
  };

  const filtered = partners.filter(p =>
    !search ||
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.registration_code?.toLowerCase().includes(search.toLowerCase())
  );

  const activeIntegrations = partners.filter(p => p.integration_status === 'connected').length;
  const avgSla = useMemo(() => {
    const scored = partners.filter(p => p.sla_score != null);
    if (scored.length === 0) return 0;
    return Math.round(scored.reduce((sum, p) => sum + p.sla_score, 0) / scored.length * 10) / 10;
  }, [partners]);
  const avgCompleteness = useMemo(() => {
    if (partners.length === 0) return 0;
    return Math.round(partners.reduce((s, p) => s + (p.completeness_score || 0), 0) / partners.length);
  }, [partners]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">파트너 관리</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/contracts')}>계약 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/crm')}>CRM</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>파트너 등록</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <HandshakeIcon color="primary" />
            <Typography variant="caption" color="text.secondary">전체 파트너</Typography>
            <Typography variant="h2">{partners.length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <LinkIcon color="success" />
            <Typography variant="caption" color="text.secondary">활성 연동</Typography>
            <Typography variant="h2">{activeIntegrations}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <ScoreIcon color="info" />
            <Typography variant="caption" color="text.secondary">평균 SLA</Typography>
            <Typography variant="h2">{avgSla}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <CategoryIcon sx={{ color: '#ed6c02' }} />
            <Typography variant="caption" color="text.secondary">데이터 완성도</Typography>
            <Typography variant="h2">{avgCompleteness}%</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField size="small" placeholder="이름, 담당자, 등록코드 검색" value={search} onChange={e => setSearch(e.target.value)} sx={{ width: 320 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
        <TextField select size="small" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} sx={{ width: 160 }}>
          <MenuItem value="all">전체 카테고리</MenuItem>
          {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ width: 160 }}>
          <MenuItem value="all">전체 연동 상태</MenuItem>
          {integrationStatuses.map(s => <MenuItem key={s} value={s}>{integrationLabels[s]}</MenuItem>)}
        </TextField>
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>등록코드</TableCell>
                <TableCell>이름</TableCell>
                <TableCell>카테고리</TableCell>
                <TableCell>등급</TableCell>
                <TableCell>담당자</TableCell>
                <TableCell>SLA</TableCell>
                <TableCell>연동</TableCell>
                <TableCell>완성도</TableCell>
                <TableCell align="center">관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(p => (
                <TableRow key={p.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'primary.main' }}>
                      {p.registration_code || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{p.business_number || ''}</Typography>
                  </TableCell>
                  <TableCell>{p.category || '-'}</TableCell>
                  <TableCell>
                    {p.tier ? (
                      <Chip label={tierLabels[p.tier] || p.tier} size="small" sx={{ bgcolor: tierColors[p.tier] || '#ccc', color: '#fff', fontWeight: 600 }} />
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{p.contact_name || '-'}</Typography>
                    <Typography variant="caption" color="text.secondary">{p.contact_email || ''}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{
                      fontWeight: 600,
                      color: p.sla_score != null ? p.sla_score >= 90 ? 'success.main' : p.sla_score >= 70 ? 'warning.main' : 'error.main' : 'text.secondary',
                    }}>
                      {p.sla_score != null ? p.sla_score : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={integrationLabels[p.integration_status] || p.integration_status} size="small" color={integrationColors[p.integration_status] || 'default'} />
                  </TableCell>
                  <TableCell>
                    <Chip label={`${p.completeness_score || 0}%`} size="small" color={(p.completeness_score || 0) >= 80 ? 'success' : (p.completeness_score || 0) >= 50 ? 'warning' : 'error'} variant="outlined" />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => handleOpenEdit(p)}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton size="small" onClick={() => setDeleteTarget(p)} sx={{ color: 'error.main' }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">파트너가 없습니다.</Typography>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Stepper Registration Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? '파트너 수정' : '파트너 등록'}</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} sx={{ my: 2 }}>
            {steps.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>

          {activeStep === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              {generatedCode && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  등록 코드: <strong>{generatedCode}</strong>
                </Alert>
              )}
              <TextField label="파트너명" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth size="small" required />
              <TextField label="카테고리" select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} fullWidth size="small">
                {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
              <TextField label="등급" select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })} fullWidth size="small">
                {tiers.map(t => <MenuItem key={t} value={t}>{tierLabels[t]}</MenuItem>)}
              </TextField>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField label="담당자 이름" value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} fullWidth size="small" />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField label="담당자 이메일" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} fullWidth size="small" />
                </Grid>
              </Grid>
              <TextField label="담당자 전화번호" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} fullWidth size="small" />
            </Box>
          )}

          {activeStep === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField label="사업자 등록번호" value={form.business_number} onChange={e => setForm({ ...form, business_number: e.target.value })} fullWidth size="small" placeholder="000-00-00000" />
              <TextField label="주소" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} fullWidth size="small" />
              <TextField label="웹사이트" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} fullWidth size="small" placeholder="https://" />
            </Box>
          )}

          {activeStep === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField label="연동 상태" select value={form.integration_status} onChange={e => setForm({ ...form, integration_status: e.target.value })} fullWidth size="small">
                {integrationStatuses.map(s => <MenuItem key={s} value={s}>{integrationLabels[s]}</MenuItem>)}
              </TextField>
              <TextField label="SLA 점수" type="number" value={form.sla_score} onChange={e => setForm({ ...form, sla_score: e.target.value })} fullWidth size="small" slotProps={{ input: { inputProps: { min: 0, max: 100 } } }} />
              <TextField label="연결 계약 ID" value={form.contract_id} onChange={e => setForm({ ...form, contract_id: e.target.value })} fullWidth size="small" />
              <Alert severity="info">
                파트너가 연결되면 계약, 인보이스, 유지보수 이력이 자동으로 연동됩니다.
              </Alert>
            </Box>
          )}

          {activeStep === 3 && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                데이터 완성도: <strong>{calcCompleteness(form)}%</strong>
              </Alert>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <Typography variant="body2"><strong>등록코드:</strong> {generatedCode}</Typography>
                <Typography variant="body2"><strong>파트너명:</strong> {form.name}</Typography>
                <Typography variant="body2"><strong>카테고리:</strong> {form.category || '-'}</Typography>
                <Typography variant="body2"><strong>등급:</strong> {tierLabels[form.tier] || '-'}</Typography>
                <Typography variant="body2"><strong>담당자:</strong> {form.contact_name || '-'}</Typography>
                <Typography variant="body2"><strong>이메일:</strong> {form.contact_email || '-'}</Typography>
                <Typography variant="body2"><strong>전화:</strong> {form.contact_phone || '-'}</Typography>
                <Typography variant="body2"><strong>사업자번호:</strong> {form.business_number || '-'}</Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2"><strong>연동 상태:</strong> {integrationLabels[form.integration_status]}</Typography>
              <Typography variant="body2"><strong>SLA 점수:</strong> {form.sla_score || '-'}</Typography>
              {form.address && <Typography variant="body2"><strong>주소:</strong> {form.address}</Typography>}
              {form.website && <Typography variant="body2"><strong>웹사이트:</strong> {form.website}</Typography>}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          <Box sx={{ flex: 1 }} />
          {activeStep > 0 && <Button onClick={() => setActiveStep(s => s - 1)}>이전</Button>}
          {activeStep < steps.length - 1 && (
            <Button variant="contained" onClick={() => setActiveStep(s => s + 1)} disabled={activeStep === 0 && !form.name}>
              다음
            </Button>
          )}
          {activeStep === steps.length - 1 && (
            <Button variant="contained" onClick={handleSave} disabled={!form.name}>
              {editing ? '수정' : '등록'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>파트너 삭제</DialogTitle>
        <DialogContent><Typography>"{deleteTarget?.name}" 파트너를 삭제하시겠습니까?</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDeleteTarget(null)}>취소</Button><Button variant="contained" color="error" onClick={handleDelete}>삭제</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

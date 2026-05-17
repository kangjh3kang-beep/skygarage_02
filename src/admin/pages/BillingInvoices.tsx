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
import MenuItem from '@mui/material/MenuItem';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PaidIcon from '@mui/icons-material/Paid';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';

interface Invoice {
  id: string;
  invoice_number: string;
  complex_id: string;
  partner_id: string;
  amount: number;
  tax: number;
  total: number;
  status: string;
  due_date: string;
  paid_date: string;
  issued_at: string;
  line_items: { description: string; amount: number }[] | null;
  notes: string;
  currency: string;
  discount_amount: number;
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
  invoice_number: string;
  amount: string;
  tax: string;
  status: string;
  due_date: string;
  complex_id: string;
  partner_id: string;
  notes: string;
  currency: string;
  discount_amount: string;
  line_items: { description: string; amount: string }[];
}

const emptyForm: FormData = {
  invoice_number: '',
  amount: '0',
  tax: '0',
  status: 'draft',
  due_date: '',
  complex_id: '',
  partner_id: '',
  notes: '',
  currency: 'KRW',
  discount_amount: '0',
  line_items: [{ description: '', amount: '0' }],
};

const statusColors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'primary'> = { draft: 'default', issued: 'primary', paid: 'success', overdue: 'error', cancelled: 'warning' };
const statusLabels: Record<string, string> = { draft: '초안', issued: '발행', paid: '수금', overdue: '연체', cancelled: '취소' };
const steps = ['기본 정보', '항목 및 금액', '연동 설정', '확인'];

export default function BillingInvoices() {
  useDocumentTitle('청구/인보이스');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeStep, setActiveStep] = useState(0);
  const [generatedCode, setGeneratedCode] = useState('');

  const loadData = useCallback(async () => {
    const [invRes, cxRes, ptRes] = await Promise.all([
      (() => {
        let q = supabase.from('billing_invoices').select('*').order('issued_at', { ascending: false });
        if (statusFilter !== 'all') q = q.eq('status', statusFilter);
        return q;
      })(),
      supabase.from('complexes').select('id, name, mdm_code').order('name'),
      supabase.from('partners').select('id, name, registration_code').order('name'),
    ]);
    if (invRes.data) setInvoices(invRes.data);
    if (cxRes.data) setComplexes(cxRes.data);
    if (ptRes.data) setPartners(ptRes.data);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('invoices-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'billing_invoices' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const handleOpenAdd = async () => {
    setEditing(null);
    setForm(emptyForm);
    setActiveStep(0);
    const { data } = await supabase.rpc('generate_entity_code', { prefix: 'INV', entity_type: 'invoice' });
    setGeneratedCode(data || '');
    setDialogOpen(true);
  };

  const handleOpenEdit = (inv: Invoice) => {
    setEditing(inv);
    setGeneratedCode(inv.invoice_number || '');
    const items = inv.line_items && inv.line_items.length > 0
      ? inv.line_items.map(li => ({ description: li.description, amount: String(li.amount) }))
      : [{ description: '', amount: '0' }];
    setForm({
      invoice_number: inv.invoice_number || '',
      amount: String(inv.amount || 0),
      tax: String(inv.tax || 0),
      status: inv.status || 'draft',
      due_date: inv.due_date || '',
      complex_id: inv.complex_id || '',
      partner_id: inv.partner_id || '',
      notes: inv.notes || '',
      currency: inv.currency || 'KRW',
      discount_amount: String(inv.discount_amount || 0),
      line_items: items,
    });
    setActiveStep(0);
    setDialogOpen(true);
  };

  const calcTotal = useMemo(() => {
    const amt = parseFloat(form.amount) || 0;
    const tax = parseFloat(form.tax) || 0;
    const disc = parseFloat(form.discount_amount) || 0;
    return amt + tax - disc;
  }, [form.amount, form.tax, form.discount_amount]);

  const handleSave = async () => {
    const amt = parseFloat(form.amount) || 0;
    const tax = parseFloat(form.tax) || 0;
    const disc = parseFloat(form.discount_amount) || 0;
    const lineItems = form.line_items
      .filter(li => li.description)
      .map(li => ({ description: li.description, amount: parseFloat(li.amount) || 0 }));
    const payload = {
      invoice_number: generatedCode || form.invoice_number,
      amount: amt,
      tax,
      total: amt + tax - disc,
      status: form.status,
      due_date: form.due_date || null,
      complex_id: form.complex_id || null,
      partner_id: form.partner_id || null,
      notes: form.notes || null,
      currency: form.currency || 'KRW',
      discount_amount: disc,
      line_items: lineItems.length > 0 ? lineItems : null,
    };
    if (editing) {
      const { error } = await supabase.from('billing_invoices').update(payload).eq('id', editing.id);
      if (error) { showToast('수정 실패: ' + error.message, 'error'); return; }
      logAction('UPDATE', 'billing_invoices', editing.id, { invoice_number: payload.invoice_number });
      showToast('인보이스가 수정되었습니다.', 'success');
    } else {
      const { error } = await supabase.from('billing_invoices').insert(payload);
      if (error) { showToast('등록 실패: ' + error.message, 'error'); return; }
      logAction('CREATE', 'billing_invoices', undefined, { invoice_number: payload.invoice_number });
      showToast('인보이스가 등록되었습니다.', 'success');
    }
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('billing_invoices').delete().eq('id', deleteTarget.id);
    if (error) { showToast('삭제 실패', 'error'); return; }
    logAction('DELETE', 'billing_invoices', deleteTarget.id, { invoice_number: deleteTarget.invoice_number });
    showToast('삭제 완료', 'success');
    setDeleteTarget(null);
    loadData();
  };

  const handleMarkPaid = useCallback(async (inv: Invoice) => {
    const { error } = await supabase.from('billing_invoices').update({ status: 'paid', paid_date: new Date().toISOString() }).eq('id', inv.id);
    if (error) { showToast('처리 실패', 'error'); return; }
    logAction('UPDATE', 'billing_invoices', inv.id, { action: 'mark_paid' });
    showToast('입금 처리 완료', 'success');
    loadData();
  }, [showToast, logAction, loadData]);

  const addLineItem = () => {
    setForm(prev => ({ ...prev, line_items: [...prev.line_items, { description: '', amount: '0' }] }));
  };

  const removeLineItem = (idx: number) => {
    setForm(prev => ({ ...prev, line_items: prev.line_items.filter((_, i) => i !== idx) }));
  };

  const updateLineItem = (idx: number, field: 'description' | 'amount', value: string) => {
    setForm(prev => ({
      ...prev,
      line_items: prev.line_items.map((li, i) => i === idx ? { ...li, [field]: value } : li),
    }));
  };

  const totalAmount = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const paidAmount = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0);
  const overdueCount = invoices.filter(i => i.status === 'overdue' || (i.due_date && new Date(i.due_date) < new Date() && i.status !== 'paid' && i.status !== 'cancelled')).length;
  const pendingCount = invoices.filter(i => i.status === 'issued').length;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">청구 / 인보이스</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/contracts')}>계약 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/partners')}>파트너</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>인보이스 등록</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <ReceiptLongIcon color="primary" />
            <Typography variant="caption" color="text.secondary">총 청구액</Typography>
            <Typography variant="h2">{(totalAmount / 10000).toFixed(0)}만원</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <PaidIcon sx={{ color: '#2e7d32' }} />
            <Typography variant="caption" color="text.secondary">수금 완료</Typography>
            <Typography variant="h2" color="success.main">{(paidAmount / 10000).toFixed(0)}만원</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <AccountBalanceIcon sx={{ color: '#0288d1' }} />
            <Typography variant="caption" color="text.secondary">발행 대기</Typography>
            <Typography variant="h2" color="info.main">{pendingCount}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <WarningAmberIcon sx={{ color: '#d32f2f' }} />
            <Typography variant="caption" color="text.secondary">연체</Typography>
            <Typography variant="h2" color="error.main">{overdueCount}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Box sx={{ mb: 2 }}>
        <TextField select size="small" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ width: 160 }}>
          <MenuItem value="all">전체</MenuItem>
          <MenuItem value="draft">초안</MenuItem>
          <MenuItem value="issued">발행</MenuItem>
          <MenuItem value="paid">수금</MenuItem>
          <MenuItem value="overdue">연체</MenuItem>
        </TextField>
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>인보이스번호</TableCell>
              <TableCell>단지</TableCell>
              <TableCell>파트너</TableCell>
              <TableCell>상태</TableCell>
              <TableCell align="right">공급가</TableCell>
              <TableCell align="right">합계</TableCell>
              <TableCell>만기일</TableCell>
              <TableCell align="center">관리</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {invoices.map(inv => {
                const cx = complexes.find(c => c.id === inv.complex_id);
                const pt = partners.find(p => p.id === inv.partner_id);
                const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'paid' && inv.status !== 'cancelled';
                return (
                  <TableRow key={inv.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', color: 'primary.main' }}>
                        {inv.invoice_number}
                      </Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary">{cx?.name || '-'}</Typography></TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary">{pt?.name || '-'}</Typography></TableCell>
                    <TableCell><Chip label={statusLabels[inv.status] || inv.status} size="small" color={statusColors[inv.status] || 'default'} /></TableCell>
                    <TableCell align="right">{(inv.amount || 0).toLocaleString()}</TableCell>
                    <TableCell align="right"><Typography sx={{ fontWeight: 600 }}>{(inv.total || 0).toLocaleString()}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="caption" color={isOverdue ? 'error' : 'text.secondary'} sx={{ fontWeight: isOverdue ? 700 : 400 }}>
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString('ko-KR') : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                        <Chip label="입금" size="small" color="success" onClick={() => handleMarkPaid(inv)} sx={{ cursor: 'pointer', mr: 0.5 }} />
                      )}
                      <IconButton size="small" onClick={() => handleOpenEdit(inv)}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                      <IconButton size="small" onClick={() => setDeleteTarget(inv)} sx={{ color: 'error.main' }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {invoices.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">등록된 인보이스가 없습니다.</Typography>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Stepper Registration Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? '인보이스 수정' : '인보이스 등록'}</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} sx={{ my: 2 }}>
            {steps.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>

          {activeStep === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              {generatedCode && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  인보이스 번호: <strong>{generatedCode}</strong>
                </Alert>
              )}
              <TextField label="상태" select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} fullWidth size="small">
                <MenuItem value="draft">초안</MenuItem>
                <MenuItem value="issued">발행</MenuItem>
                <MenuItem value="paid">수금</MenuItem>
                <MenuItem value="overdue">연체</MenuItem>
                <MenuItem value="cancelled">취소</MenuItem>
              </TextField>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField label="만기일" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField label="통화" select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} fullWidth size="small">
                    <MenuItem value="KRW">KRW (원)</MenuItem>
                    <MenuItem value="USD">USD ($)</MenuItem>
                    <MenuItem value="EUR">EUR</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
              <TextField label="비고" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth size="small" multiline rows={2} />
            </Box>
          )}

          {activeStep === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">청구 항목</Typography>
              {form.line_items.map((li, idx) => (
                <Grid container spacing={1} key={idx} sx={{ alignItems: 'center' }}>
                  <Grid size={{ xs: 7 }}>
                    <TextField label="항목 설명" value={li.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} fullWidth size="small" />
                  </Grid>
                  <Grid size={{ xs: 3 }}>
                    <TextField label="금액" type="number" value={li.amount} onChange={e => updateLineItem(idx, 'amount', e.target.value)} fullWidth size="small" />
                  </Grid>
                  <Grid size={{ xs: 2 }}>
                    <IconButton size="small" onClick={() => removeLineItem(idx)} disabled={form.line_items.length <= 1} sx={{ color: 'error.main' }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
              <Button size="small" onClick={addLineItem} startIcon={<AddIcon />} sx={{ alignSelf: 'flex-start' }}>항목 추가</Button>
              <Divider />
              <Grid container spacing={2}>
                <Grid size={{ xs: 4 }}>
                  <TextField label="공급가" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} fullWidth size="small" />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <TextField label="세금" type="number" value={form.tax} onChange={e => setForm({ ...form, tax: e.target.value })} fullWidth size="small" />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <TextField label="할인" type="number" value={form.discount_amount} onChange={e => setForm({ ...form, discount_amount: e.target.value })} fullWidth size="small" />
                </Grid>
              </Grid>
              <Alert severity="info">
                합계: <strong>{calcTotal.toLocaleString()} {form.currency}</strong>
              </Alert>
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
                단지/파트너를 연결하면 계약 정보와 자동으로 매칭됩니다.
              </Alert>
            </Box>
          )}

          {activeStep === 3 && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <Typography variant="body2"><strong>인보이스번호:</strong> {generatedCode}</Typography>
                <Typography variant="body2"><strong>상태:</strong> {statusLabels[form.status] || form.status}</Typography>
                <Typography variant="body2"><strong>공급가:</strong> {Number(form.amount).toLocaleString()}</Typography>
                <Typography variant="body2"><strong>세금:</strong> {Number(form.tax).toLocaleString()}</Typography>
                <Typography variant="body2"><strong>할인:</strong> {Number(form.discount_amount).toLocaleString()}</Typography>
                <Typography variant="body2"><strong>합계:</strong> {calcTotal.toLocaleString()} {form.currency}</Typography>
                <Typography variant="body2"><strong>만기일:</strong> {form.due_date || '-'}</Typography>
                <Typography variant="body2"><strong>단지:</strong> {complexes.find(cx => cx.id === form.complex_id)?.name || '미지정'}</Typography>
                <Typography variant="body2"><strong>파트너:</strong> {partners.find(p => p.id === form.partner_id)?.name || '미지정'}</Typography>
              </Box>
              {form.line_items.filter(li => li.description).length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>청구 항목</Typography>
                  {form.line_items.filter(li => li.description).map((li, idx) => (
                    <Typography key={idx} variant="body2">- {li.description}: {Number(li.amount).toLocaleString()}</Typography>
                  ))}
                </>
              )}
              {form.notes && (
                <Typography variant="body2" sx={{ mt: 1 }}><strong>비고:</strong> {form.notes}</Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          <Box sx={{ flex: 1 }} />
          {activeStep > 0 && <Button onClick={() => setActiveStep(s => s - 1)}>이전</Button>}
          {activeStep < steps.length - 1 && (
            <Button variant="contained" onClick={() => setActiveStep(s => s + 1)}>다음</Button>
          )}
          {activeStep === steps.length - 1 && (
            <Button variant="contained" onClick={handleSave}>
              {editing ? '수정' : '등록'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>인보이스 삭제</DialogTitle>
        <DialogContent><Typography>"{deleteTarget?.invoice_number}" 인보이스를 삭제하시겠습니까?</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDeleteTarget(null)}>취소</Button><Button variant="contained" color="error" onClick={handleDelete}>삭제</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

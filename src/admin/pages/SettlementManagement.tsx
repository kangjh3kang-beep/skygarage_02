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
import ApartmentIcon from '@mui/icons-material/Apartment';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PercentIcon from '@mui/icons-material/Percent';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useAuth } from '../contexts/AuthContext';

interface SettlementRecord {
  id: string;
  transaction_id: string;
  user_id: string;
  user_home_complex_id: string;
  service_complex_id: string;
  service_type: string;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  net_amount: number;
  status: string;
  batch_id: string | null;
  created_at: string;
}

interface SettlementBatch {
  id: string;
  complex_id: string;
  period_start: string;
  period_end: string;
  total_gross: number;
  total_commission: number;
  total_net: number;
  record_count: number;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
}

interface CommissionRate {
  id: string;
  complex_id: string | null;
  service_type: string;
  rate: number;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
}

interface Complex {
  id: string;
  name: string;
}

const statusColors: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  pending: 'warning',
  batched: 'info',
  draft: 'default',
  confirmed: 'info',
  approved: 'success',
  paid: 'success',
  disputed: 'error',
};

const statusLabels: Record<string, string> = {
  pending: '대기',
  batched: '배치됨',
  draft: '초안',
  confirmed: '확정',
  approved: '승인',
  paid: '지급완료',
  disputed: '분쟁',
};

const serviceLabels: Record<string, string> = {
  parking: '주차',
  valet_standard: '발렛(일반)',
  valet_premium: '발렛(프리미엄)',
};

export default function SettlementManagement() {
  useDocumentTitle('정산 관리');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [records, setRecords] = useState<SettlementRecord[]>([]);
  const [batches, setBatches] = useState<SettlementBatch[]>([]);
  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [complexFilter, setComplexFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailRecord, setDetailRecord] = useState<SettlementRecord | null>(null);
  const [detailBatch, setDetailBatch] = useState<SettlementBatch | null>(null);
  const [rateDialog, setRateDialog] = useState(false);
  const [rateForm, setRateForm] = useState({ service_type: 'parking', rate: 0.10, complex_id: '' });
  const [batchDialog, setBatchDialog] = useState(false);
  const [batchForm, setBatchForm] = useState({ complex_id: '', period_start: '', period_end: '' });

  const isSuperAdmin = role === 'super_admin';

  const complexName = (id?: string | null) => {
    if (!id) return '전역';
    return complexes.find(c => c.id === id)?.name || '-';
  };

  const loadData = useCallback(async () => {
    const [cRes, rRes, bRes, crRes] = await Promise.all([
      supabase.from('complexes').select('id, name'),
      supabase.from('settlement_records').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('settlement_batches').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('settlement_commission_rates').select('*').order('created_at', { ascending: false }),
    ]);
    if (cRes.data) setComplexes(cRes.data);
    if (rRes.data) setRecords(rRes.data);
    if (bRes.data) setBatches(bRes.data);
    if (crRes.data) setRates(crRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredRecords = records.filter(r => {
    if (complexFilter !== 'all' && r.service_complex_id !== complexFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const filteredBatches = batches.filter(b => {
    if (complexFilter !== 'all' && b.complex_id !== complexFilter) return false;
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    return true;
  });

  const totalPending = records.filter(r => r.status === 'pending').reduce((s, r) => s + r.net_amount, 0);
  const totalPaid = batches.filter(b => b.status === 'paid').reduce((s, b) => s + b.total_net, 0);
  const totalCommission = records.reduce((s, r) => s + r.commission_amount, 0);

  const handleCreateBatch = async () => {
    if (!batchForm.complex_id || !batchForm.period_start || !batchForm.period_end) {
      showToast('모든 필드를 입력하세요', 'error');
      return;
    }

    const pendingRecords = records.filter(
      r => r.service_complex_id === batchForm.complex_id
        && r.status === 'pending'
        && r.created_at >= batchForm.period_start
        && r.created_at <= batchForm.period_end + 'T23:59:59Z'
    );

    if (pendingRecords.length === 0) {
      showToast('해당 기간에 정산 대기 건이 없습니다', 'warning');
      return;
    }

    const totalGross = pendingRecords.reduce((s, r) => s + r.gross_amount, 0);
    const totalComm = pendingRecords.reduce((s, r) => s + r.commission_amount, 0);
    const totalNet = pendingRecords.reduce((s, r) => s + r.net_amount, 0);

    const { data: batch, error } = await supabase.from('settlement_batches').insert({
      complex_id: batchForm.complex_id,
      period_start: batchForm.period_start,
      period_end: batchForm.period_end,
      total_gross: totalGross,
      total_commission: totalComm,
      total_net: totalNet,
      record_count: pendingRecords.length,
      status: 'confirmed',
    }).select().maybeSingle();

    if (error || !batch) { showToast('배치 생성 실패', 'error'); return; }

    await supabase.from('settlement_records')
      .update({ status: 'batched', batch_id: batch.id })
      .in('id', pendingRecords.map(r => r.id));

    logAction('CREATE', 'settlement_batches', batch.id, { record_count: pendingRecords.length, total_net: totalNet });
    showToast(`정산 배치 생성 완료 (${pendingRecords.length}건, ${totalNet.toLocaleString()} 코인)`, 'success');
    setBatchDialog(false);
    loadData();
  };

  const handleApproveBatch = async (batch: SettlementBatch) => {
    const { error } = await supabase.from('settlement_batches')
      .update({ status: 'approved', approved_by: (await supabase.auth.getUser()).data.user?.id, approved_at: new Date().toISOString() })
      .eq('id', batch.id);

    if (error) { showToast('승인 실패', 'error'); return; }
    logAction('UPDATE', 'settlement_batches', batch.id, { action: 'approve' });
    showToast('정산 승인 완료', 'success');
    setDetailBatch(null);
    loadData();
  };

  const handleMarkPaid = async (batch: SettlementBatch) => {
    const ref = prompt('지급 참조번호를 입력하세요 (계좌이체 번호 등):');
    if (!ref) return;

    const { error } = await supabase.from('settlement_batches')
      .update({ status: 'paid', paid_at: new Date().toISOString(), payment_reference: ref })
      .eq('id', batch.id);

    if (error) { showToast('지급 처리 실패', 'error'); return; }

    await supabase.from('settlement_records')
      .update({ status: 'paid' })
      .eq('batch_id', batch.id);

    logAction('UPDATE', 'settlement_batches', batch.id, { action: 'mark_paid', payment_reference: ref });
    showToast('지급 완료 처리됨', 'success');
    setDetailBatch(null);
    loadData();
  };

  const handleSaveRate = async () => {
    const { error } = await supabase.from('settlement_commission_rates').insert({
      complex_id: rateForm.complex_id || null,
      service_type: rateForm.service_type,
      rate: rateForm.rate,
      effective_from: new Date().toISOString().split('T')[0],
    });

    if (error) { showToast('수수료율 저장 실패', 'error'); return; }
    showToast('수수료율 설정 완료', 'success');
    setRateDialog(false);
    loadData();
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={36} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map(i => <Grid size={{ xs: 6, md: 3 }} key={i}><Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} /></Grid>)}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h1">정산 관리</Typography>
          <Typography variant="body2" color="text.secondary">타 단지 이용 수수료 정산 및 지급 관리</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isSuperAdmin && (
            <Button variant="outlined" size="small" startIcon={<PercentIcon />} onClick={() => setRateDialog(true)}>수수료율 설정</Button>
          )}
          <Button variant="contained" size="small" startIcon={<ReceiptLongIcon />} onClick={() => setBatchDialog(true)}>배치 생성</Button>
        </Box>
      </Box>

      {/* Info Banner */}
      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        <Typography variant="body2">
          사용자가 소속 외 단지에서 코인 결제 시, 플랫폼 수수료를 차감한 금액이 해당 단지 관리주체에 정산됩니다.
          기본 수수료: 주차 10% / 발렛(일반) 15% / 발렛(프리미엄) 20%
        </Typography>
      </Alert>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">정산 대기</Typography>
              <Typography variant="h2" color="warning.main">{totalPending.toLocaleString()}</Typography>
              <Typography variant="caption" color="text.secondary">코인</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">누적 지급</Typography>
              <Typography variant="h2" color="success.main">{totalPaid.toLocaleString()}</Typography>
              <Typography variant="caption" color="text.secondary">코인</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">수수료 수입</Typography>
              <Typography variant="h2">{totalCommission.toLocaleString()}</Typography>
              <Typography variant="caption" color="text.secondary">코인</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary">총 건수</Typography>
              <Typography variant="h2">{records.length}</Typography>
              <Typography variant="caption" color="text.secondary">건</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs + Filters */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={`정산 건 (${filteredRecords.length})`} />
          <Tab label={`배치 (${filteredBatches.length})`} />
          <Tab label={`수수료율 (${rates.length})`} />
        </Tabs>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField select size="small" label="단지" value={complexFilter} onChange={e => setComplexFilter(e.target.value)} sx={{ minWidth: 130 }}>
            <MenuItem value="all">전체</MenuItem>
            {complexes.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          {tab < 2 && (
            <TextField select size="small" label="상태" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ minWidth: 100 }}>
              <MenuItem value="all">전체</MenuItem>
              <MenuItem value="pending">대기</MenuItem>
              <MenuItem value="batched">배치됨</MenuItem>
              <MenuItem value="approved">승인</MenuItem>
              <MenuItem value="paid">지급완료</MenuItem>
            </TextField>
          )}
        </Box>
      </Box>

      {/* Tab 0: Settlement Records */}
      {tab === 0 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>서비스 단지</TableCell>
                  <TableCell>서비스 유형</TableCell>
                  <TableCell align="right">이용료</TableCell>
                  <TableCell align="right">수수료</TableCell>
                  <TableCell align="right">정산액</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell>일시</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}><Typography variant="body2" color="text.secondary">정산 건이 없습니다</Typography></TableCell></TableRow>
                ) : filteredRecords.map(r => (
                  <TableRow key={r.id} hover onClick={() => setDetailRecord(r)} sx={{ cursor: 'pointer' }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <ApartmentIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>{complexName(r.service_complex_id)}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell><Chip label={serviceLabels[r.service_type] || r.service_type} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} /></TableCell>
                    <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 500 }}>{r.gross_amount.toLocaleString()}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="caption" color="error.main">-{r.commission_amount.toLocaleString()}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 700 }}>{r.net_amount.toLocaleString()}</Typography></TableCell>
                    <TableCell><Chip label={statusLabels[r.status] || r.status} size="small" color={statusColors[r.status] || 'default'} sx={{ height: 20, fontSize: '0.65rem' }} /></TableCell>
                    <TableCell><Typography variant="caption">{new Date(r.created_at).toLocaleDateString('ko-KR')}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Tab 1: Batches */}
      {tab === 1 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>정산 단지</TableCell>
                  <TableCell>기간</TableCell>
                  <TableCell align="right">총 이용료</TableCell>
                  <TableCell align="right">수수료</TableCell>
                  <TableCell align="right">지급액</TableCell>
                  <TableCell align="center">건수</TableCell>
                  <TableCell>상태</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredBatches.length === 0 ? (
                  <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}><Typography variant="body2" color="text.secondary">정산 배치가 없습니다</Typography></TableCell></TableRow>
                ) : filteredBatches.map(b => (
                  <TableRow key={b.id} hover onClick={() => setDetailBatch(b)} sx={{ cursor: 'pointer' }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <ApartmentIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>{complexName(b.complex_id)}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="caption">{b.period_start} ~ {b.period_end}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2">{b.total_gross.toLocaleString()}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="caption" color="error.main">-{b.total_commission.toLocaleString()}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 700 }}>{b.total_net.toLocaleString()}</Typography></TableCell>
                    <TableCell align="center"><Typography variant="caption">{b.record_count}</Typography></TableCell>
                    <TableCell><Chip label={statusLabels[b.status] || b.status} size="small" color={statusColors[b.status] || 'default'} sx={{ height: 20, fontSize: '0.65rem' }} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Tab 2: Commission Rates */}
      {tab === 2 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>적용 대상</TableCell>
                  <TableCell>서비스 유형</TableCell>
                  <TableCell align="right">수수료율</TableCell>
                  <TableCell>적용 시작</TableCell>
                  <TableCell>적용 종료</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rates.map(r => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>{r.complex_id ? complexName(r.complex_id) : '전역 기본'}</Typography>
                    </TableCell>
                    <TableCell><Chip label={serviceLabels[r.service_type] || r.service_type} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} /></TableCell>
                    <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 700 }}>{(r.rate * 100).toFixed(0)}%</Typography></TableCell>
                    <TableCell><Typography variant="caption">{r.effective_from}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{r.effective_to || '무기한'}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Record Detail Dialog */}
      <Dialog open={!!detailRecord} onClose={() => setDetailRecord(null)} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        {detailRecord && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>정산 상세</Typography>
              <IconButton size="small" onClick={() => setDetailRecord(null)}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 2.5 }}>
                <Chip label={statusLabels[detailRecord.status] || detailRecord.status} size="small" color={statusColors[detailRecord.status] || 'default'} sx={{ mr: 1 }} />
                <Chip label={serviceLabels[detailRecord.service_type] || detailRecord.service_type} size="small" variant="outlined" />
              </Box>

              <Box sx={{ mb: 2.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>서비스 제공 단지</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                  <ApartmentIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{complexName(detailRecord.service_complex_id)}</Typography>
                </Box>
              </Box>

              {detailRecord.user_home_complex_id && (
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>사용자 소속 단지</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <ApartmentIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{complexName(detailRecord.user_home_complex_id)}</Typography>
                  </Box>
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid size={{ xs: 4 }}>
                  <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>이용료</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>{detailRecord.gross_amount.toLocaleString()}</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.05)' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>수수료 ({(detailRecord.commission_rate * 100).toFixed(0)}%)</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700, color: 'error.main' }}>-{detailRecord.commission_amount.toLocaleString()}</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: 'rgba(16,185,129,0.05)' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>정산액</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700, color: 'success.main' }}>{detailRecord.net_amount.toLocaleString()}</Typography>
                  </Box>
                </Grid>
              </Grid>

              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">거래일시: {new Date(detailRecord.created_at).toLocaleString('ko-KR')}</Typography>
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* Batch Detail Dialog */}
      <Dialog open={!!detailBatch} onClose={() => setDetailBatch(null)} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        {detailBatch && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>정산 배치 상세</Typography>
              <IconButton size="small" onClick={() => setDetailBatch(null)}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 2.5 }}>
                <Chip label={statusLabels[detailBatch.status] || detailBatch.status} size="small" color={statusColors[detailBatch.status] || 'default'} sx={{ mr: 1 }} />
                <Chip label={`${detailBatch.record_count}건`} size="small" variant="outlined" />
              </Box>

              <Box sx={{ mb: 2.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>정산 대상 단지 (주차관리주체)</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                  <AccountBalanceIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{complexName(detailBatch.complex_id)}</Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">정산 기간: {detailBatch.period_start} ~ {detailBatch.period_end}</Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 4 }}>
                  <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>총 이용료</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>{detailBatch.total_gross.toLocaleString()}</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.05)' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>수수료</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700, color: 'error.main' }}>-{detailBatch.total_commission.toLocaleString()}</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: 'rgba(16,185,129,0.05)' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>지급액</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700, color: 'success.main' }}>{detailBatch.total_net.toLocaleString()}</Typography>
                  </Box>
                </Grid>
              </Grid>

              {detailBatch.payment_reference && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">지급 참조: {detailBatch.payment_reference}</Typography>
                </Box>
              )}

              {detailBatch.paid_at && (
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                  <Typography variant="caption" color="success.main">지급 완료: {new Date(detailBatch.paid_at).toLocaleString('ko-KR')}</Typography>
                </Box>
              )}

              {/* Actions */}
              <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
                {detailBatch.status === 'confirmed' && isSuperAdmin && (
                  <Button variant="contained" size="small" color="success" onClick={() => handleApproveBatch(detailBatch)}>승인</Button>
                )}
                {detailBatch.status === 'approved' && isSuperAdmin && (
                  <Button variant="contained" size="small" onClick={() => handleMarkPaid(detailBatch)}>지급 완료 처리</Button>
                )}
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* Rate Setting Dialog */}
      <Dialog open={rateDialog} onClose={() => setRateDialog(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle>수수료율 설정</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              select
              label="적용 대상"
              value={rateForm.complex_id}
              onChange={e => setRateForm({ ...rateForm, complex_id: e.target.value })}
              size="small"
              fullWidth
            >
              <MenuItem value="">전역 기본</MenuItem>
              {complexes.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField
              select
              label="서비스 유형"
              value={rateForm.service_type}
              onChange={e => setRateForm({ ...rateForm, service_type: e.target.value })}
              size="small"
              fullWidth
            >
              <MenuItem value="parking">주차</MenuItem>
              <MenuItem value="valet_standard">발렛 (일반)</MenuItem>
              <MenuItem value="valet_premium">발렛 (프리미엄)</MenuItem>
            </TextField>
            <TextField
              label="수수료율 (%)"
              type="number"
              value={(rateForm.rate * 100).toFixed(0)}
              onChange={e => setRateForm({ ...rateForm, rate: Number(e.target.value) / 100 })}
              size="small"
              fullWidth
              slotProps={{ htmlInput: { min: 0, max: 50, step: 1 } }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRateDialog(false)}>취소</Button>
          <Button variant="contained" onClick={handleSaveRate}>저장</Button>
        </DialogActions>
      </Dialog>

      {/* Batch Create Dialog */}
      <Dialog open={batchDialog} onClose={() => setBatchDialog(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle>정산 배치 생성</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            선택 단지의 정산 대기 건을 기간별로 집계합니다.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              select
              label="정산 대상 단지"
              value={batchForm.complex_id}
              onChange={e => setBatchForm({ ...batchForm, complex_id: e.target.value })}
              size="small"
              fullWidth
            >
              {complexes.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField
              label="기간 시작"
              type="date"
              value={batchForm.period_start}
              onChange={e => setBatchForm({ ...batchForm, period_start: e.target.value })}
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="기간 종료"
              type="date"
              value={batchForm.period_end}
              onChange={e => setBatchForm({ ...batchForm, period_end: e.target.value })}
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchDialog(false)}>취소</Button>
          <Button variant="contained" onClick={handleCreateBatch}>생성</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

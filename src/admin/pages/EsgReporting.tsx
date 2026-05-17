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
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VerifiedIcon from '@mui/icons-material/Verified';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';

interface EsgCertification {
  id: string;
  complex_id: string;
  cert_name: string;
  cert_code: string;
  status: string;
  issued_by: string;
  issued_date: string;
  expiry_date: string;
  notes: string;
  created_at: string;
}

const statusColors: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  active: 'success',
  expired: 'error',
  pending: 'warning',
  revoked: 'default',
};

const statusLabels: Record<string, string> = {
  active: '유효',
  expired: '만료',
  pending: '대기',
  revoked: '폐지',
};

const emptyForm = {
  complex_id: '',
  cert_name: '',
  cert_code: '',
  status: 'pending',
  issued_by: '',
  issued_date: '',
  expiry_date: '',
  notes: '',
};

const EXPIRING_SOON_DAYS = 90;

export default function EsgReporting() {
  useDocumentTitle('ESG 인증 관리');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [certifications, setCertifications] = useState<EsgCertification[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EsgCertification | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<EsgCertification | null>(null);

  const loadData = useCallback(async () => {
    let query = supabase
      .from('esg_certifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    const { data } = await query;
    if (data) setCertifications(data);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('esg-certs-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'esg_certifications' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const isExpiringSoon = useCallback((expiryDate: string) => {
    if (!expiryDate) return false;
    const diff = new Date(expiryDate).getTime() - Date.now();
    return diff > 0 && diff < EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
  }, []);

  const summary = useMemo(() => {
    const total = certifications.length;
    const active = certifications.filter(c => c.status === 'active').length;
    const expired = certifications.filter(c => c.status === 'expired').length;
    const expiringSoon = certifications.filter(c => c.status === 'active' && isExpiringSoon(c.expiry_date)).length;
    return { total, active, expired, expiringSoon };
  }, [certifications, isExpiringSoon]);

  const openCreateDialog = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (cert: EsgCertification) => {
    setEditing(cert);
    setForm({
      complex_id: cert.complex_id || '',
      cert_name: cert.cert_name || '',
      cert_code: cert.cert_code || '',
      status: cert.status || 'pending',
      issued_by: cert.issued_by || '',
      issued_date: cert.issued_date || '',
      expiry_date: cert.expiry_date || '',
      notes: cert.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      complex_id: form.complex_id || null,
      cert_name: form.cert_name,
      cert_code: form.cert_code || null,
      status: form.status,
      issued_by: form.issued_by || null,
      issued_date: form.issued_date || null,
      expiry_date: form.expiry_date || null,
      notes: form.notes || null,
    };

    if (editing) {
      const { error } = await supabase.from('esg_certifications').update(payload).eq('id', editing.id);
      if (error) { showToast('수정 실패: ' + error.message, 'error'); return; }
      logAction('UPDATE', 'esg_certifications', editing.id, { cert_name: payload.cert_name, status: payload.status });
      showToast('ESG 인증이 수정되었습니다.', 'success');
    } else {
      const { error } = await supabase.from('esg_certifications').insert(payload);
      if (error) { showToast('등록 실패: ' + error.message, 'error'); return; }
      logAction('CREATE', 'esg_certifications', undefined, { cert_name: payload.cert_name, status: payload.status });
      showToast('ESG 인증이 등록되었습니다.', 'success');
    }
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('esg_certifications').delete().eq('id', deleteTarget.id);
    if (error) { showToast('삭제 실패', 'error'); return; }
    logAction('DELETE', 'esg_certifications', deleteTarget.id, { cert_name: deleteTarget.cert_name });
    showToast('ESG 인증이 삭제되었습니다.', 'success');
    setDeleteTarget(null);
    loadData();
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">ESG 인증 관리</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/energy')}>에너지</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/contracts')}>계약 관리</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>인증 등록</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <VerifiedIcon color="primary" />
            <Typography variant="caption" color="text.secondary">전체 인증</Typography>
            <Typography variant="h2">{summary.total}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">유효 인증</Typography>
            <Typography variant="h2" color="success.main">{summary.active}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">만료 인증</Typography>
            <Typography variant="h2" color="error.main">{summary.expired}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <WarningAmberIcon color="warning" />
            <Typography variant="caption" color="text.secondary">만료 임박 (90일)</Typography>
            <Typography variant="h2" color="warning.main">{summary.expiringSoon}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField select size="small" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ width: 180 }}>
          <MenuItem value="all">전체 상태</MenuItem>
          <MenuItem value="active">유효</MenuItem>
          <MenuItem value="expired">만료</MenuItem>
          <MenuItem value="pending">대기</MenuItem>
          <MenuItem value="revoked">폐지</MenuItem>
        </TextField>
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>인증명</TableCell>
                <TableCell>인증코드</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>발급기관</TableCell>
                <TableCell>발급일</TableCell>
                <TableCell>만료일</TableCell>
                <TableCell>비고</TableCell>
                <TableCell align="center">관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {certifications.map(cert => (
                <TableRow key={cert.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{cert.cert_name}</Typography>
                    {cert.status === 'active' && isExpiringSoon(cert.expiry_date) && (
                      <Chip icon={<WarningAmberIcon />} label="만료 임박" size="small" color="warning" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{cert.cert_code || '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={statusLabels[cert.status] || cert.status} size="small" color={statusColors[cert.status] || 'default'} />
                  </TableCell>
                  <TableCell>{cert.issued_by || '-'}</TableCell>
                  <TableCell>
                    <Typography variant="caption">{cert.issued_date ? new Date(cert.issued_date).toLocaleDateString('ko-KR') : '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color={cert.status === 'active' && isExpiringSoon(cert.expiry_date) ? 'error' : 'text.secondary'}>
                      {cert.expiry_date ? new Date(cert.expiry_date).toLocaleDateString('ko-KR') : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cert.notes || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => openEditDialog(cert)}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton size="small" onClick={() => setDeleteTarget(cert)} sx={{ color: 'error.main' }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {certifications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>등록된 ESG 인증이 없습니다.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'ESG 인증 수정' : 'ESG 인증 등록'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="인증명" value={form.cert_name} onChange={e => setForm({ ...form, cert_name: e.target.value })} fullWidth size="small" required />
          <TextField label="인증코드" value={form.cert_code} onChange={e => setForm({ ...form, cert_code: e.target.value })} fullWidth size="small" />
          <TextField label="단지 ID" value={form.complex_id} onChange={e => setForm({ ...form, complex_id: e.target.value })} fullWidth size="small" />
          <TextField label="상태" select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} fullWidth size="small">
            <MenuItem value="pending">대기</MenuItem>
            <MenuItem value="active">유효</MenuItem>
            <MenuItem value="expired">만료</MenuItem>
            <MenuItem value="revoked">폐지</MenuItem>
          </TextField>
          <TextField label="발급기관" value={form.issued_by} onChange={e => setForm({ ...form, issued_by: e.target.value })} fullWidth size="small" />
          <TextField label="발급일" type="date" value={form.issued_date} onChange={e => setForm({ ...form, issued_date: e.target.value })} fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="만료일" type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="비고" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth size="small" multiline rows={3} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.cert_name}>{editing ? '수정' : '등록'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>ESG 인증 삭제</DialogTitle>
        <DialogContent>
          <Typography>"{deleteTarget?.cert_name}" 인증을 삭제하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>취소</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>삭제</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

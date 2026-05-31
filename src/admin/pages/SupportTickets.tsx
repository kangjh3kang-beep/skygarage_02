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
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';

interface SupportTicket {
  id: string;
  complex_id: string;
  resident_id: string;
  ticket_number: string;
  channel: string;
  priority: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  assigned_to: string;
  sla_due_at: string;
  first_response_at: string;
  resolved_at: string;
  satisfaction: number | null;
  resolution_notes: string;
  escalated: boolean;
  feedback_score: number | null;
  completeness_score: number;
  created_at: string;
}

interface Complex {
  id: string;
  name: string;
  mdm_code: string;
}

interface Resident {
  id: string;
  name: string;
  registration_code: string;
  unit_number: string;
}

interface FormData {
  ticket_number: string;
  complex_id: string;
  resident_id: string;
  channel: string;
  priority: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  assigned_to: string;
  sla_due_at: string;
  resolution_notes: string;
  escalated: boolean;
}

const emptyForm: FormData = {
  ticket_number: '',
  complex_id: '',
  resident_id: '',
  channel: 'web',
  priority: 'medium',
  category: '',
  subject: '',
  description: '',
  status: 'open',
  assigned_to: '',
  sla_due_at: '',
  resolution_notes: '',
  escalated: false,
};

const priorityColors: Record<string, 'default' | 'info' | 'warning' | 'error'> = { low: 'default', medium: 'info', high: 'warning', urgent: 'error' };
const priorityLabels: Record<string, string> = { low: '낮음', medium: '보통', high: '높음', urgent: '긴급' };
const statusColors: Record<string, 'default' | 'primary' | 'warning' | 'success' | 'error'> = { open: 'primary', in_progress: 'warning', waiting: 'default', resolved: 'success', closed: 'error' };
const statusLabels: Record<string, string> = { open: '접수', in_progress: '처리중', waiting: '대기', resolved: '해결', closed: '종료' };
const channelLabels: Record<string, string> = { web: '웹', app: '앱', phone: '전화', email: '이메일', visit: '방문' };
const ticketCategories = ['시설', '주차', '소음', '보안', '청소', '엘리베이터', '기타'];

const steps = ['기본 정보', '상세 내용', '연동/배정', '확인'];

function calcCompleteness(form: FormData): number {
  const fields = [
    form.subject,
    form.description,
    form.category,
    form.channel,
    form.priority,
    form.complex_id,
    form.resident_id,
    form.assigned_to,
    form.sla_due_at,
    form.status,
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

export default function SupportTickets() {
  useDocumentTitle('지원 티켓');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SupportTicket | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<SupportTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [activeStep, setActiveStep] = useState(0);
  const [generatedCode, setGeneratedCode] = useState('');

  const loadData = useCallback(async () => {
    const [ticketRes, cxRes, resRes] = await Promise.all([
      (() => {
        let q = supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
        if (statusFilter !== 'all') q = q.eq('status', statusFilter);
        if (priorityFilter !== 'all') q = q.eq('priority', priorityFilter);
        return q;
      })(),
      supabase.from('complexes').select('id, name, mdm_code').order('name'),
      supabase.from('resident_accounts').select('id, name, registration_code, unit_number').order('name'),
    ]);
    if (ticketRes.data) setTickets(ticketRes.data);
    if (cxRes.data) setComplexes(cxRes.data);
    if (resRes.data) setResidents(resRes.data);
    setLoading(false);
  }, [statusFilter, priorityFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('support-tickets-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const handleOpenAdd = async () => {
    setEditing(null);
    setForm(emptyForm);
    setActiveStep(0);
    const { data } = await supabase.rpc('generate_entity_code', { prefix: 'TKT', entity_type: 'ticket' });
    setGeneratedCode(data || '');
    setDialogOpen(true);
  };

  const handleOpenEdit = (ticket: SupportTicket) => {
    setEditing(ticket);
    setGeneratedCode(ticket.ticket_number || '');
    setForm({
      ticket_number: ticket.ticket_number || '',
      complex_id: ticket.complex_id || '',
      resident_id: ticket.resident_id || '',
      channel: ticket.channel || 'web',
      priority: ticket.priority || 'medium',
      category: ticket.category || '',
      subject: ticket.subject || '',
      description: ticket.description || '',
      status: ticket.status || 'open',
      assigned_to: ticket.assigned_to || '',
      sla_due_at: ticket.sla_due_at ? ticket.sla_due_at.slice(0, 16) : '',
      resolution_notes: ticket.resolution_notes || '',
      escalated: ticket.escalated || false,
    });
    setActiveStep(0);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const completeness = calcCompleteness(form);
    const payload = {
      ticket_number: generatedCode || form.ticket_number,
      complex_id: form.complex_id || null,
      resident_id: form.resident_id || null,
      channel: form.channel,
      priority: form.priority,
      category: form.category || null,
      subject: form.subject,
      description: form.description || null,
      status: form.status,
      assigned_to: form.assigned_to || null,
      sla_due_at: form.sla_due_at || null,
      resolution_notes: form.resolution_notes || null,
      escalated: form.escalated,
      completeness_score: completeness,
    };
    if (editing) {
      const { error } = await supabase.from('support_tickets').update(payload).eq('id', editing.id);
      if (error) { showToast('수정 실패: ' + error.message, 'error'); return; }
      logAction('UPDATE', 'support_tickets', editing.id, { ticket_number: payload.ticket_number });
      showToast('티켓이 수정되었습니다.', 'success');
    } else {
      const { error } = await supabase.from('support_tickets').insert(payload);
      if (error) { showToast('등록 실패: ' + error.message, 'error'); return; }
      logAction('CREATE', 'support_tickets', undefined, { ticket_number: payload.ticket_number });
      showToast('티켓이 등록되었습니다.', 'success');
    }
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('support_tickets').delete().eq('id', deleteTarget.id);
    if (error) { showToast('삭제 실패', 'error'); return; }
    logAction('DELETE', 'support_tickets', deleteTarget.id, { ticket_number: deleteTarget.ticket_number });
    showToast('삭제 완료', 'success');
    setDeleteTarget(null);
    loadData();
  };

  const totalTickets = tickets.length;
  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting').length;
  const overdueTickets = tickets.filter(t => t.sla_due_at && new Date(t.sla_due_at) < new Date() && t.status !== 'resolved' && t.status !== 'closed').length;
  const avgSatisfaction = useMemo(() => {
    const rated = tickets.filter(t => t.satisfaction != null);
    if (rated.length === 0) return null;
    return (rated.reduce((sum, t) => sum + (t.satisfaction ?? 0), 0) / rated.length).toFixed(1);
  }, [tickets]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">지원 티켓</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/alerts')}>알림 센터</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/maintenance')}>정비 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/residents')}>사용자</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>티켓 등록</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">전체 티켓</Typography>
            <Typography variant="h2">{totalTickets}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">미해결</Typography>
            <Typography variant="h2" color="primary.main">{openTickets}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">SLA 초과</Typography>
            <Typography variant="h2" color="error.main">{overdueTickets}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">평균 만족도</Typography>
            <Typography variant="h2" color="success.main">{avgSatisfaction ?? '-'}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Box sx={{ mb: 2, display: 'flex', gap: 1.5 }}>
        <TextField select label="상태" size="small" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ width: 160 }}>
          <MenuItem value="all">전체</MenuItem>
          <MenuItem value="open">접수</MenuItem>
          <MenuItem value="in_progress">처리중</MenuItem>
          <MenuItem value="waiting">대기</MenuItem>
          <MenuItem value="resolved">해결</MenuItem>
          <MenuItem value="closed">종료</MenuItem>
        </TextField>
        <TextField select label="우선순위" size="small" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} sx={{ width: 160 }}>
          <MenuItem value="all">전체</MenuItem>
          <MenuItem value="low">낮음</MenuItem>
          <MenuItem value="medium">보통</MenuItem>
          <MenuItem value="high">높음</MenuItem>
          <MenuItem value="urgent">긴급</MenuItem>
        </TextField>
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>티켓번호</TableCell>
                <TableCell>제목</TableCell>
                <TableCell>카테고리</TableCell>
                <TableCell>채널</TableCell>
                <TableCell>우선순위</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>단지</TableCell>
                <TableCell>SLA 기한</TableCell>
                <TableCell>완성도</TableCell>
                <TableCell align="center">관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.map(ticket => {
                const slaOverdue = ticket.sla_due_at && new Date(ticket.sla_due_at) < new Date() && ticket.status !== 'resolved' && ticket.status !== 'closed';
                const cx = complexes.find(c => c.id === ticket.complex_id);
                return (
                  <TableRow key={ticket.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', color: 'primary.main' }}>
                        {ticket.ticket_number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{ticket.subject}</Typography>
                      {ticket.escalated && <Chip label="에스컬레이션" size="small" color="error" sx={{ ml: 0.5, height: 18, fontSize: '0.625rem' }} />}
                    </TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary">{ticket.category || '-'}</Typography></TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary">{channelLabels[ticket.channel] || ticket.channel || '-'}</Typography></TableCell>
                    <TableCell><Chip label={priorityLabels[ticket.priority] || ticket.priority} size="small" color={priorityColors[ticket.priority] || 'default'} /></TableCell>
                    <TableCell><Chip label={statusLabels[ticket.status] || ticket.status} size="small" color={statusColors[ticket.status] || 'default'} /></TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">{cx?.name || '-'}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="caption" color={slaOverdue ? 'error' : 'text.secondary'} sx={{ fontWeight: slaOverdue ? 700 : 400 }}>
                        {ticket.sla_due_at ? new Date(ticket.sla_due_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={`${ticket.completeness_score || 0}%`} size="small" color={(ticket.completeness_score || 0) >= 80 ? 'success' : (ticket.completeness_score || 0) >= 50 ? 'warning' : 'error'} variant="outlined" />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleOpenEdit(ticket)}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                      <IconButton size="small" onClick={() => setDeleteTarget(ticket)} sx={{ color: 'error.main' }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {tickets.length === 0 && (
                <TableRow><TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">등록된 티켓이 없습니다.</Typography>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Stepper Registration Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? '티켓 수정' : '티켓 등록'}</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} sx={{ my: 2 }}>
            {steps.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>

          {activeStep === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              {generatedCode && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  티켓 번호: <strong>{generatedCode}</strong>
                </Alert>
              )}
              <TextField label="제목" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} fullWidth size="small" required />
              <TextField label="카테고리" select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} fullWidth size="small">
                {ticketCategories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField label="채널" select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })} fullWidth size="small">
                    <MenuItem value="web">웹</MenuItem>
                    <MenuItem value="app">앱</MenuItem>
                    <MenuItem value="phone">전화</MenuItem>
                    <MenuItem value="email">이메일</MenuItem>
                    <MenuItem value="visit">방문</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField label="우선순위" select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} fullWidth size="small">
                    <MenuItem value="low">낮음</MenuItem>
                    <MenuItem value="medium">보통</MenuItem>
                    <MenuItem value="high">높음</MenuItem>
                    <MenuItem value="urgent">긴급</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
              <TextField label="상태" select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} fullWidth size="small">
                <MenuItem value="open">접수</MenuItem>
                <MenuItem value="in_progress">처리중</MenuItem>
                <MenuItem value="waiting">대기</MenuItem>
                <MenuItem value="resolved">해결</MenuItem>
                <MenuItem value="closed">종료</MenuItem>
              </TextField>
            </Box>
          )}

          {activeStep === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField label="설명" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} fullWidth size="small" multiline rows={4} />
              <TextField label="해결 노트" value={form.resolution_notes} onChange={e => setForm({ ...form, resolution_notes: e.target.value })} fullWidth size="small" multiline rows={2} />
              <TextField label="SLA 기한" type="datetime-local" value={form.sla_due_at} onChange={e => setForm({ ...form, sla_due_at: e.target.value })} fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} />
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
              <TextField label="연결 사용자" select value={form.resident_id} onChange={e => setForm({ ...form, resident_id: e.target.value })} fullWidth size="small">
                <MenuItem value="">미지정</MenuItem>
                {residents.map(r => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.registration_code ? `[${r.registration_code}] ` : ''}{r.name} {r.unit_number ? `(${r.unit_number})` : ''}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="담당자" value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} fullWidth size="small" />
              <Alert severity="info">
                단지/사용자을 연결하면 이력 관리 및 AI 자동 분류가 활성화됩니다.
              </Alert>
            </Box>
          )}

          {activeStep === 3 && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                데이터 완성도: <strong>{calcCompleteness(form)}%</strong>
              </Alert>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <Typography variant="body2"><strong>티켓번호:</strong> {generatedCode}</Typography>
                <Typography variant="body2"><strong>상태:</strong> {statusLabels[form.status] || form.status}</Typography>
                <Typography variant="body2"><strong>제목:</strong> {form.subject}</Typography>
                <Typography variant="body2"><strong>카테고리:</strong> {form.category || '-'}</Typography>
                <Typography variant="body2"><strong>우선순위:</strong> {priorityLabels[form.priority]}</Typography>
                <Typography variant="body2"><strong>채널:</strong> {channelLabels[form.channel]}</Typography>
                <Typography variant="body2"><strong>담당자:</strong> {form.assigned_to || '미배정'}</Typography>
                <Typography variant="body2"><strong>SLA 기한:</strong> {form.sla_due_at || '-'}</Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2"><strong>단지:</strong> {complexes.find(cx => cx.id === form.complex_id)?.name || '미지정'}</Typography>
              <Typography variant="body2"><strong>사용자:</strong> {residents.find(r => r.id === form.resident_id)?.name || '미지정'}</Typography>
              {form.description && <Typography variant="body2" sx={{ mt: 1 }}><strong>설명:</strong> {form.description}</Typography>}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          <Box sx={{ flex: 1 }} />
          {activeStep > 0 && <Button onClick={() => setActiveStep(s => s - 1)}>이전</Button>}
          {activeStep < steps.length - 1 && (
            <Button variant="contained" onClick={() => setActiveStep(s => s + 1)} disabled={activeStep === 0 && !form.subject}>
              다음
            </Button>
          )}
          {activeStep === steps.length - 1 && (
            <Button variant="contained" onClick={handleSave} disabled={!form.subject}>
              {editing ? '수정' : '등록'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>티켓 삭제</DialogTitle>
        <DialogContent><Typography>"{deleteTarget?.ticket_number}" 티켓을 삭제하시겠습니까?</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDeleteTarget(null)}>취소</Button><Button variant="contained" color="error" onClick={handleDelete}>삭제</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

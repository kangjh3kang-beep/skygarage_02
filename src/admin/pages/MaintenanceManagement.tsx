import { useState, useEffect, useCallback } from 'react';
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
import LinearProgress from '@mui/material/LinearProgress';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useNavigate } from 'react-router-dom';

interface MaintenanceLog {
  id: string;
  complex_id: string;
  target_type: string;
  target_id: string;
  target_code: string;
  maintenance_type: string;
  status: string;
  priority: string;
  title: string;
  description: string;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  technician: string;
  parts_used: string;
  cost: number;
  notes: string;
  created_at: string;
  entity_code?: string;
  completeness_score?: number;
}

interface Complex {
  id: string;
  name: string;
  code: string;
}

const STEPS = ['기본 정보', '정비 상세', '연동 설정', '확인'];

const emptyForm = {
  complex_id: '',
  target_type: '',
  target_id: '',
  target_code: '',
  maintenance_type: 'preventive',
  status: 'scheduled',
  priority: 'medium',
  title: '',
  description: '',
  scheduled_at: '',
  started_at: '',
  completed_at: '',
  technician: '',
  parts_used: '',
  cost: '0',
  notes: '',
};

const statusMap: Record<string, { color: 'info' | 'warning' | 'success' | 'default'; label: string }> = {
  scheduled: { color: 'info', label: '예정' },
  in_progress: { color: 'warning', label: '진행중' },
  completed: { color: 'success', label: '완료' },
  cancelled: { color: 'default', label: '취소' },
};

const priorityMap: Record<string, { color: 'error' | 'warning' | 'primary' | 'default'; label: string }> = {
  critical: { color: 'error', label: '긴급' },
  high: { color: 'warning', label: '높음' },
  medium: { color: 'primary', label: '보통' },
  low: { color: 'default', label: '낮음' },
};

const maintenanceTypeMap: Record<string, string> = {
  preventive: '예방 정비',
  corrective: '수정 정비',
  inspection: '점검',
  emergency: '긴급 수리',
};

function computeCompleteness(form: typeof emptyForm): number {
  const fields = [
    { val: form.title, w: 20 },
    { val: form.complex_id, w: 15 },
    { val: form.target_type, w: 10 },
    { val: form.target_code, w: 10 },
    { val: form.maintenance_type, w: 10 },
    { val: form.technician, w: 10 },
    { val: form.scheduled_at, w: 10 },
    { val: form.description, w: 10 },
    { val: form.priority, w: 5 },
  ];
  return fields.reduce((sum, f) => sum + (f.val ? f.w : 0), 0);
}

export default function MaintenanceManagement() {
  useDocumentTitle('정비 관리');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceLog | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeStep, setActiveStep] = useState(0);
  const [generatedCode, setGeneratedCode] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceLog | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const loadData = useCallback(async () => {
    const [logRes, complexRes] = await Promise.all([
      (() => {
        let query = supabase.from('maintenance_logs').select('*').order('scheduled_at', { ascending: false }).limit(300);
        if (statusFilter !== 'all') query = query.eq('status', statusFilter);
        if (priorityFilter !== 'all') query = query.eq('priority', priorityFilter);
        return query;
      })(),
      supabase.from('complexes').select('id, name, code').order('name'),
    ]);
    if (logRes.data) setLogs(logRes.data);
    if (complexRes.data) setComplexes(complexRes.data);
    setLoading(false);
  }, [statusFilter, priorityFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('maintenance-logs-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_logs' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const generateCode = async () => {
    const { data } = await supabase.rpc('generate_entity_code', { prefix: 'MNT' });
    if (data) setGeneratedCode(data);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setActiveStep(0);
    setGeneratedCode('');
    generateCode();
    setDialogOpen(true);
  };

  const openEdit = (log: MaintenanceLog) => {
    setEditing(log);
    setGeneratedCode(log.entity_code || '');
    setForm({
      complex_id: log.complex_id || '',
      target_type: log.target_type || '',
      target_id: log.target_id || '',
      target_code: log.target_code || '',
      maintenance_type: log.maintenance_type || 'preventive',
      status: log.status || 'scheduled',
      priority: log.priority || 'medium',
      title: log.title || '',
      description: log.description || '',
      scheduled_at: log.scheduled_at ? log.scheduled_at.slice(0, 16) : '',
      started_at: log.started_at ? log.started_at.slice(0, 16) : '',
      completed_at: log.completed_at ? log.completed_at.slice(0, 16) : '',
      technician: log.technician || '',
      parts_used: log.parts_used || '',
      cost: String(log.cost ?? 0),
      notes: log.notes || '',
    });
    setActiveStep(0);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const completeness = computeCompleteness(form);
    const payload = {
      complex_id: form.complex_id || null,
      target_type: form.target_type || null,
      target_id: form.target_id || null,
      target_code: form.target_code || null,
      maintenance_type: form.maintenance_type,
      status: form.status,
      priority: form.priority,
      title: form.title,
      description: form.description || null,
      scheduled_at: form.scheduled_at || null,
      started_at: form.started_at || null,
      completed_at: form.completed_at || null,
      technician: form.technician || null,
      parts_used: form.parts_used || null,
      cost: parseFloat(form.cost) || 0,
      notes: form.notes || null,
      entity_code: generatedCode || null,
      completeness_score: completeness,
    };
    if (editing) {
      const { error } = await supabase.from('maintenance_logs').update(payload).eq('id', editing.id);
      if (error) { showToast('수정 실패: ' + error.message, 'error'); return; }
      logAction('UPDATE', 'maintenance_logs', editing.id, { title: payload.title });
      showToast('정비 작업이 수정되었습니다.', 'success');
    } else {
      const { error } = await supabase.from('maintenance_logs').insert(payload);
      if (error) { showToast('등록 실패: ' + error.message, 'error'); return; }
      logAction('CREATE', 'maintenance_logs', undefined, { title: payload.title });
      showToast('정비 작업이 등록되었습니다.', 'success');
    }
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('maintenance_logs').delete().eq('id', deleteTarget.id);
    if (error) { showToast('삭제 실패', 'error'); return; }
    logAction('DELETE', 'maintenance_logs', deleteTarget.id, { title: deleteTarget.title });
    showToast('삭제 완료', 'success');
    setDeleteTarget(null);
    loadData();
  };

  const totalCount = logs.length;
  const scheduledCount = logs.filter(l => l.status === 'scheduled').length;
  const inProgressCount = logs.filter(l => l.status === 'in_progress').length;
  const completedCount = logs.filter(l => l.status === 'completed').length;
  const avgCompleteness = logs.length > 0
    ? Math.round(logs.reduce((s, l) => s + (l.completeness_score || 0), 0) / logs.length)
    : 0;

  const completeness = computeCompleteness(form);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">엔티티 코드</Typography>
              <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{generatedCode || '생성 중...'}</Typography>
            </Box>
            <TextField label="제목" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} fullWidth size="small" required />
            <TextField label="단지" select value={form.complex_id} onChange={e => setForm({ ...form, complex_id: e.target.value })} fullWidth size="small">
              <MenuItem value="">선택 안함</MenuItem>
              {complexes.map(c => <MenuItem key={c.id} value={c.id}>{c.name} ({c.code})</MenuItem>)}
            </TextField>
            <TextField label="우선순위" select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} fullWidth size="small">
              <MenuItem value="critical">긴급</MenuItem>
              <MenuItem value="high">높음</MenuItem>
              <MenuItem value="medium">보통</MenuItem>
              <MenuItem value="low">낮음</MenuItem>
            </TextField>
            <TextField label="상태" select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} fullWidth size="small">
              <MenuItem value="scheduled">예정</MenuItem>
              <MenuItem value="in_progress">진행중</MenuItem>
              <MenuItem value="completed">완료</MenuItem>
              <MenuItem value="cancelled">취소</MenuItem>
            </TextField>
          </Box>
        );
      case 1:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="정비 유형" select value={form.maintenance_type} onChange={e => setForm({ ...form, maintenance_type: e.target.value })} fullWidth size="small">
              <MenuItem value="preventive">예방 정비</MenuItem>
              <MenuItem value="corrective">수정 정비</MenuItem>
              <MenuItem value="inspection">점검</MenuItem>
              <MenuItem value="emergency">긴급 수리</MenuItem>
            </TextField>
            <TextField label="대상 유형" value={form.target_type} onChange={e => setForm({ ...form, target_type: e.target.value })} fullWidth size="small" placeholder="elevator, atr, parking 등" />
            <TextField label="대상 코드" value={form.target_code} onChange={e => setForm({ ...form, target_code: e.target.value })} fullWidth size="small" />
            <TextField label="기술자" value={form.technician} onChange={e => setForm({ ...form, technician: e.target.value })} fullWidth size="small" />
            <TextField label="설명" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} fullWidth size="small" multiline rows={3} />
            <TextField label="사용 부품" value={form.parts_used} onChange={e => setForm({ ...form, parts_used: e.target.value })} fullWidth size="small" />
            <TextField label="비용 (원)" type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} fullWidth size="small" />
          </Box>
        );
      case 2:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="예정일"
              type="datetime-local"
              value={form.scheduled_at}
              onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
              fullWidth size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="시작일"
              type="datetime-local"
              value={form.started_at}
              onChange={e => setForm({ ...form, started_at: e.target.value })}
              fullWidth size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="완료일"
              type="datetime-local"
              value={form.completed_at}
              onChange={e => setForm({ ...form, completed_at: e.target.value })}
              fullWidth size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField label="메모" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth size="small" multiline rows={2} />
          </Box>
        );
      case 3:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>등록 정보 확인</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="caption" color="text.secondary">완성도</Typography>
              <LinearProgress variant="determinate" value={completeness} sx={{ flex: 1, height: 8, borderRadius: 1 }} color={completeness >= 80 ? 'success' : completeness >= 50 ? 'warning' : 'error'} />
              <Typography variant="caption" sx={{ fontWeight: 700 }}>{completeness}%</Typography>
            </Box>
            <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2 }}>
              <Grid container spacing={1}>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">코드</Typography><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{generatedCode}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">제목</Typography><Typography variant="body2">{form.title || '-'}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">단지</Typography><Typography variant="body2">{complexes.find(c => c.id === form.complex_id)?.name || '-'}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">우선순위</Typography><Typography variant="body2">{priorityMap[form.priority]?.label || form.priority}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">유형</Typography><Typography variant="body2">{maintenanceTypeMap[form.maintenance_type] || form.maintenance_type}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">기술자</Typography><Typography variant="body2">{form.technician || '-'}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">예정일</Typography><Typography variant="body2">{form.scheduled_at ? new Date(form.scheduled_at).toLocaleString('ko-KR') : '-'}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">비용</Typography><Typography variant="body2">{form.cost ? `${Number(form.cost).toLocaleString()}원` : '-'}</Typography></Grid>
              </Grid>
            </Box>
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">정비 관리</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/ai-management')}>AI 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/workflows')}>워크플로우</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/alerts')}>알림 센터</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/complexes')}>단지 관리</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>정비 등록</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">전체 작업</Typography>
            <Typography variant="h2" color="primary">{totalCount}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">예정</Typography>
            <Typography variant="h2" color="info.main">{scheduledCount}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">진행중</Typography>
            <Typography variant="h2" color="warning.main">{inProgressCount}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">완료</Typography>
            <Typography variant="h2" color="success.main">{completedCount}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">평균 완성도</Typography>
            <Typography variant="h2" color={avgCompleteness >= 80 ? 'success.main' : avgCompleteness >= 50 ? 'warning.main' : 'error.main'}>{avgCompleteness}%</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          select size="small" label="상태"
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          sx={{ minWidth: 140 }} slotProps={{ inputLabel: { shrink: true } }}
        >
          <MenuItem value="all">전체 상태</MenuItem>
          <MenuItem value="scheduled">예정</MenuItem>
          <MenuItem value="in_progress">진행중</MenuItem>
          <MenuItem value="completed">완료</MenuItem>
          <MenuItem value="cancelled">취소</MenuItem>
        </TextField>
        <TextField
          select size="small" label="우선순위"
          value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
          sx={{ minWidth: 140 }} slotProps={{ inputLabel: { shrink: true } }}
        >
          <MenuItem value="all">전체 우선순위</MenuItem>
          <MenuItem value="critical">긴급</MenuItem>
          <MenuItem value="high">높음</MenuItem>
          <MenuItem value="medium">보통</MenuItem>
          <MenuItem value="low">낮음</MenuItem>
        </TextField>
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>코드</TableCell>
              <TableCell>제목</TableCell>
              <TableCell>대상 코드</TableCell>
              <TableCell>유형</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>우선순위</TableCell>
              <TableCell>기술자</TableCell>
              <TableCell>예정일</TableCell>
              <TableCell>완성도</TableCell>
              <TableCell align="center">관리</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {logs.map(log => {
                const st = statusMap[log.status] || { color: 'default' as const, label: log.status };
                const pr = priorityMap[log.priority] || { color: 'default' as const, label: log.priority };
                const cs = log.completeness_score || 0;
                return (
                  <TableRow key={log.id} hover>
                    <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{log.entity_code || '-'}</Typography></TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{log.title}</Typography></TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{log.target_code || '-'}</Typography></TableCell>
                    <TableCell>{maintenanceTypeMap[log.maintenance_type] || log.maintenance_type || '-'}</TableCell>
                    <TableCell><Chip label={st.label} size="small" color={st.color} /></TableCell>
                    <TableCell><Chip label={pr.label} size="small" color={pr.color} /></TableCell>
                    <TableCell>{log.technician || '-'}</TableCell>
                    <TableCell><Typography variant="caption">{log.scheduled_at ? new Date(log.scheduled_at).toLocaleDateString('ko-KR') : '-'}</Typography></TableCell>
                    <TableCell>
                      <Chip label={`${cs}%`} size="small" color={cs >= 80 ? 'success' : cs >= 50 ? 'warning' : 'error'} variant="outlined" />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => openEdit(log)}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                      <IconButton size="small" onClick={() => setDeleteTarget(log)} sx={{ color: 'error.main' }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={10} align="center"><Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>데이터가 없습니다.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? '정비 작업 수정' : '정비 작업 등록'}</DialogTitle>
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
            <Button variant="contained" onClick={() => setActiveStep(s => s + 1)} disabled={activeStep === 0 && !form.title}>다음</Button>
          ) : (
            <Button variant="contained" onClick={handleSave} disabled={!form.title}>{editing ? '수정' : '등록'}</Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>정비 작업 삭제</DialogTitle>
        <DialogContent><Typography>"{deleteTarget?.title}" 작업을 삭제하시겠습니까?</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDeleteTarget(null)}>취소</Button><Button variant="contained" color="error" onClick={handleDelete}>삭제</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

import { useState, useEffect, useCallback } from 'react';
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
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import GroupIcon from '@mui/icons-material/Group';
import BadgeIcon from '@mui/icons-material/Badge';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  position: string;
  phone: string;
  assigned_complex_id: string;
  status: string;
  certifications: string[];
  hire_date: string;
  last_active_at: string;
  created_at: string;
}

const departments = ['관리부', '운영부', '기술부', '보안부', '고객지원부'];
const statuses = ['active', 'inactive', 'on_leave'];
const statusLabels: Record<string, string> = { active: '활성', inactive: '비활성', on_leave: '휴직' };
const statusColors: Record<string, 'success' | 'default' | 'warning'> = { active: 'success', inactive: 'default', on_leave: 'warning' };

const emptyForm = {
  name: '',
  email: '',
  role: '',
  department: '',
  position: '',
  phone: '',
  assigned_complex_id: '',
  status: 'active',
  certifications: '',
  hire_date: '',
};

export default function TeamManagement() {
  useDocumentTitle('팀원 관리');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);

  const loadData = useCallback(async () => {
    try {
      let query = supabase.from('team_members').select('*').order('name');
      if (departmentFilter !== 'all') query = query.eq('department', departmentFilter);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) { showToast('로드 실패: ' + error.message, 'error'); return; }
      if (data) setMembers(data);
    } catch (err) {
      showToast('로드 실패: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [departmentFilter, statusFilter, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('team-members-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const handleOpenAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };

  const handleOpenEdit = (m: TeamMember) => {
    setEditing(m);
    setForm({
      name: m.name,
      email: m.email || '',
      role: m.role || '',
      department: m.department || '',
      position: m.position || '',
      phone: m.phone || '',
      assigned_complex_id: m.assigned_complex_id || '',
      status: m.status || 'active',
      certifications: Array.isArray(m.certifications) ? m.certifications.join(', ') : '',
      hire_date: m.hire_date || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const certs = form.certifications
      ? form.certifications.split(',').map(c => c.trim()).filter(Boolean)
      : [];
    const payload = {
      name: form.name,
      email: form.email,
      role: form.role,
      department: form.department,
      position: form.position,
      phone: form.phone,
      assigned_complex_id: form.assigned_complex_id || null,
      status: form.status,
      certifications: certs,
      hire_date: form.hire_date || null,
    };
    if (editing) {
      const { error } = await supabase.from('team_members').update(payload).eq('id', editing.id);
      if (error) { showToast('수정 실패: ' + error.message, 'error'); return; }
      logAction('UPDATE', 'team_members', editing.id, { name: payload.name });
      showToast('팀원 정보가 수정되었습니다.', 'success');
    } else {
      const { error } = await supabase.from('team_members').insert(payload);
      if (error) { showToast('등록 실패: ' + error.message, 'error'); return; }
      logAction('CREATE', 'team_members', undefined, { name: payload.name });
      showToast('팀원이 등록되었습니다.', 'success');
    }
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('team_members').delete().eq('id', deleteTarget.id);
    if (error) { showToast('삭제 실패: ' + error.message, 'error'); return; }
    logAction('DELETE', 'team_members', deleteTarget.id, { name: deleteTarget.name });
    showToast('삭제 완료', 'success');
    setDeleteTarget(null);
    loadData();
  };

  const filtered = members.filter(m =>
    !search || m.name?.includes(search) || m.email?.includes(search) || m.phone?.includes(search) || m.position?.includes(search)
  );

  const activeCount = members.filter(m => m.status === 'active').length;
  const deptCounts = departments.reduce<Record<string, number>>((acc, d) => {
    acc[d] = members.filter(m => m.department === d).length;
    return acc;
  }, {});
  const topDept = Object.entries(deptCounts).sort((a, b) => b[1] - a[1])[0];

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">팀원 관리</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/users')}>사용자 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/security')}>보안 감사</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>팀원 등록</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <GroupIcon color="primary" />
            <Typography variant="caption" color="text.secondary">전체 팀원</Typography>
            <Typography variant="h2">{members.length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <BadgeIcon color="success" />
            <Typography variant="caption" color="text.secondary">활성 팀원</Typography>
            <Typography variant="h2">{activeCount}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">휴직</Typography>
            <Typography variant="h2" color="warning.main">{members.filter(m => m.status === 'on_leave').length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">최다 부서</Typography>
            <Typography variant="h2">{topDept ? topDept[1] : 0}</Typography>
            <Typography variant="caption" color="text.secondary">{topDept ? topDept[0] : '-'}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField size="small" placeholder="이름, 이메일, 전화번호, 직급 검색" value={search} onChange={e => setSearch(e.target.value)} sx={{ width: 320 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
        <TextField select size="small" value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} sx={{ width: 160 }}>
          <MenuItem value="all">전체 부서</MenuItem>
          {departments.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ width: 140 }}>
          <MenuItem value="all">전체 상태</MenuItem>
          {statuses.map(s => <MenuItem key={s} value={s}>{statusLabels[s]}</MenuItem>)}
        </TextField>
      </Box>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>이름</TableCell>
                <TableCell>이메일</TableCell>
                <TableCell>부서</TableCell>
                <TableCell>직급</TableCell>
                <TableCell>전화번호</TableCell>
                <TableCell>입사일</TableCell>
                <TableCell>상태</TableCell>
                <TableCell align="center">관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(m => (
                <TableRow key={m.id} hover>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{m.name}</Typography></TableCell>
                  <TableCell><Typography variant="caption">{m.email || '-'}</Typography></TableCell>
                  <TableCell>{m.department || '-'}</TableCell>
                  <TableCell>{m.position || '-'}</TableCell>
                  <TableCell>{m.phone || '-'}</TableCell>
                  <TableCell><Typography variant="caption">{m.hire_date ? new Date(m.hire_date).toLocaleDateString('ko-KR') : '-'}</Typography></TableCell>
                  <TableCell><Chip label={statusLabels[m.status] || m.status} size="small" color={statusColors[m.status] || 'default'} /></TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => handleOpenEdit(m)}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton size="small" onClick={() => setDeleteTarget(m)} sx={{ color: 'error.main' }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center"><Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>팀원이 없습니다.</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? '팀원 수정' : '팀원 등록'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="이름" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth size="small" required />
          <TextField label="이메일" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} fullWidth size="small" />
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <TextField label="부서" select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} fullWidth size="small">
                {departments.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField label="직급" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} fullWidth size="small" />
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <TextField label="역할" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} fullWidth size="small" />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField label="전화번호" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} fullWidth size="small" />
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <TextField label="상태" select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} fullWidth size="small">
                {statuses.map(s => <MenuItem key={s} value={s}>{statusLabels[s]}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField label="입사일" type="date" value={form.hire_date} onChange={e => setForm({ ...form, hire_date: e.target.value })} fullWidth size="small"
                slotProps={{ inputLabel: { shrink: true } }} />
            </Grid>
          </Grid>
          <TextField label="배정 단지 ID" value={form.assigned_complex_id} onChange={e => setForm({ ...form, assigned_complex_id: e.target.value })} fullWidth size="small" />
          <TextField label="자격증 (쉼표 구분)" value={form.certifications} onChange={e => setForm({ ...form, certifications: e.target.value })} fullWidth size="small"
            placeholder="예: 소방안전관리자, 전기기사" />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name}>{editing ? '수정' : '등록'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>팀원 삭제</DialogTitle>
        <DialogContent><Typography>"{deleteTarget?.name}" 님을 삭제하시겠습니까?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>취소</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>삭제</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
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
import InputAdornment from '@mui/material/InputAdornment';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Badge from '@mui/material/Badge';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import LockResetIcon from '@mui/icons-material/LockReset';
import EmailIcon from '@mui/icons-material/Email';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingIcon from '@mui/icons-material/Pending';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';

interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  role: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  display_name: string;
  created_at: string;
}

interface CredentialChangeRequest {
  id: string;
  requester_id: string;
  target_user_id: string | null;
  target_user_email: string;
  change_type: 'email_change' | 'password_reset' | 'user_create' | 'user_delete';
  new_value: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approver_id: string | null;
  approved_at: string | null;
  rejected_reason: string;
  created_at: string;
  expires_at: string;
}

interface ComplexAssignment {
  id: string;
  user_id: string;
  complex_id: string;
  role_override: string;
  permissions: Record<string, boolean>;
  assigned_at: string;
}

const ROLES = [
  { value: 'super_admin', label: '최고 관리자' },
  { value: 'admin', label: '관리자' },
  { value: 'manager', label: '매니저' },
  { value: 'operator', label: '운영자' },
  { value: 'viewer', label: '조회자' },
];

const roleColorMap: Record<string, 'error' | 'warning' | 'primary' | 'info' | 'default'> = {
  super_admin: 'error',
  admin: 'warning',
  manager: 'primary',
  operator: 'info',
  viewer: 'default',
};

const changeTypeLabels: Record<string, string> = {
  email_change: '이메일 변경',
  password_reset: '비밀번호 재설정',
  user_create: '회원 생성',
  user_delete: '회원 삭제',
};

const statusLabels: Record<string, { label: string; color: 'warning' | 'success' | 'error' }> = {
  pending: { label: '승인 대기', color: 'warning' },
  approved: { label: '승인됨', color: 'success' },
  rejected: { label: '거절됨', color: 'error' },
};

const emptyRoleForm = { user_id: '', role: 'viewer', display_name: '' };
const emptyAssignmentForm = { complex_id: '', role_override: '', permissions: '{}' };

export default function UserManagement() {
  useDocumentTitle('사용자 관리');
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');

  // Current user state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Auth users state
  const [authUsers, setAuthUsers] = useState<AuthUser[]>([]);
  const [createUserDialog, setCreateUserDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', display_name: '', reason: '' });
  const [editEmailDialog, setEditEmailDialog] = useState<AuthUser | null>(null);
  const [editEmailValue, setEditEmailValue] = useState('');
  const [editEmailReason, setEditEmailReason] = useState('');
  const [resetPwDialog, setResetPwDialog] = useState<AuthUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetPwReason, setResetPwReason] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deleteAuthUser, setDeleteAuthUser] = useState<AuthUser | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  // Approval requests state
  const [requests, setRequests] = useState<CredentialChangeRequest[]>([]);
  const [rejectDialog, setRejectDialog] = useState<CredentialChangeRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // User roles state
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<UserRole | null>(null);
  const [assignmentDialog, setAssignmentDialog] = useState<UserRole | null>(null);
  const [assignments, setAssignments] = useState<ComplexAssignment[]>([]);
  const [assignmentForm, setAssignmentForm] = useState(emptyAssignmentForm);

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-management`;
  const apiHeaders = {
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  const loadAuthUsers = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}?action=list`, { headers: apiHeaders });
      const data = await res.json();
      if (data.users) setAuthUsers(data.users);
    } catch { /* handled silently */ }
  }, [apiUrl]);

  const loadRoles = useCallback(async () => {
    const { data } = await supabase.from('user_roles').select('*').order('created_at', { ascending: false });
    if (data) setUserRoles(data);
  }, []);

  const loadRequests = useCallback(async () => {
    const { data } = await supabase.from('credential_change_requests').select('*').order('created_at', { ascending: false });
    if (data) setRequests(data);
  }, []);

  const checkCurrentUser = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (userId) {
      setCurrentUserId(userId);
      try {
        const res = await fetch(`${apiUrl}?action=check-super-admin&user_id=${userId}`, { headers: apiHeaders });
        const data = await res.json();
        setIsSuperAdmin(data.is_super_admin === true);
      } catch { /* handled silently */ }
    }
  }, [apiUrl]);

  const loadData = useCallback(async () => {
    await Promise.all([loadAuthUsers(), loadRoles(), loadRequests(), checkCurrentUser()]);
    setLoading(false);
  }, [loadAuthUsers, loadRoles, loadRequests, checkCurrentUser]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('user-mgmt-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => { loadRoles(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credential_change_requests' }, () => { loadRequests(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadRoles, loadRequests]);

  const loadAssignments = useCallback(async (userId: string) => {
    const { data } = await supabase.from('user_complex_assignments').select('*').eq('user_id', userId).order('assigned_at', { ascending: false });
    if (data) setAssignments(data);
  }, []);

  // Submit approval request
  const submitRequest = async (changeType: string, targetUserId: string | null, targetEmail: string, newValue: string, reason: string) => {
    if (!currentUserId) { showToast('세션이 만료되었습니다.', 'error'); return false; }

    // If current user is super_admin, execute directly
    if (isSuperAdmin) {
      return true;
    }

    const { error } = await supabase.from('credential_change_requests').insert({
      requester_id: currentUserId,
      target_user_id: targetUserId,
      target_user_email: targetEmail,
      change_type: changeType,
      new_value: newValue,
      reason: reason,
    });

    if (error) {
      showToast('요청 등록 실패: ' + error.message, 'error');
      return false;
    }

    showToast('승인 요청이 제출되었습니다. 최고 관리자의 승인을 기다려주세요.', 'info');
    loadRequests();
    return false;
  };

  // Auth user actions
  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password) { showToast('이메일과 비밀번호를 입력하세요.', 'error'); return; }

    if (isSuperAdmin) {
      try {
        const res = await fetch(`${apiUrl}?action=create`, {
          method: 'POST', headers: apiHeaders,
          body: JSON.stringify({ email: createForm.email, password: createForm.password, user_metadata: { display_name: createForm.display_name } }),
        });
        const data = await res.json();
        if (data.error) { showToast('생성 실패: ' + data.error, 'error'); return; }
        logAction('CREATE', 'auth_users', data.id, { email: createForm.email });
        showToast('회원이 생성되었습니다.', 'success');
        loadAuthUsers();
      } catch { showToast('네트워크 오류', 'error'); return; }
    } else {
      const meta = JSON.stringify({ password: createForm.password, display_name: createForm.display_name });
      await submitRequest('user_create', null, createForm.email, meta, createForm.reason);
    }

    setCreateUserDialog(false);
    setCreateForm({ email: '', password: '', display_name: '', reason: '' });
  };

  const handleUpdateEmail = async () => {
    if (!editEmailDialog || !editEmailValue) return;

    if (isSuperAdmin) {
      try {
        const res = await fetch(`${apiUrl}?action=update-email`, {
          method: 'POST', headers: apiHeaders,
          body: JSON.stringify({ user_id: editEmailDialog.id, email: editEmailValue }),
        });
        const data = await res.json();
        if (data.error) { showToast('이메일 변경 실패: ' + data.error, 'error'); return; }
        logAction('UPDATE', 'auth_users', editEmailDialog.id, { action: 'email_change', new_email: editEmailValue });
        showToast('이메일이 변경되었습니다.', 'success');
        loadAuthUsers();
      } catch { showToast('네트워크 오류', 'error'); return; }
    } else {
      await submitRequest('email_change', editEmailDialog.id, editEmailDialog.email || '', editEmailValue, editEmailReason);
    }

    setEditEmailDialog(null);
    setEditEmailReason('');
  };

  const handleResetPassword = async () => {
    if (!resetPwDialog || !newPassword) return;
    if (newPassword.length < 6) { showToast('비밀번호는 6자 이상이어야 합니다.', 'error'); return; }

    if (isSuperAdmin) {
      try {
        const res = await fetch(`${apiUrl}?action=update-password`, {
          method: 'POST', headers: apiHeaders,
          body: JSON.stringify({ user_id: resetPwDialog.id, password: newPassword }),
        });
        const data = await res.json();
        if (data.error) { showToast('비밀번호 변경 실패: ' + data.error, 'error'); return; }
        logAction('UPDATE', 'auth_users', resetPwDialog.id, { action: 'password_reset' });
        showToast('비밀번호가 변경되었습니다.', 'success');
      } catch { showToast('네트워크 오류', 'error'); return; }
    } else {
      await submitRequest('password_reset', resetPwDialog.id, resetPwDialog.email || '', newPassword, resetPwReason);
    }

    setResetPwDialog(null);
    setNewPassword('');
    setResetPwReason('');
  };

  const handleDeleteAuthUser = async () => {
    if (!deleteAuthUser) return;

    if (isSuperAdmin) {
      try {
        const res = await fetch(`${apiUrl}?action=delete`, {
          method: 'POST', headers: apiHeaders,
          body: JSON.stringify({ user_id: deleteAuthUser.id }),
        });
        const data = await res.json();
        if (data.error) { showToast('삭제 실패: ' + data.error, 'error'); return; }
        logAction('DELETE', 'auth_users', deleteAuthUser.id, { email: deleteAuthUser.email });
        showToast('회원이 삭제되었습니다.', 'success');
        loadAuthUsers();
      } catch { showToast('네트워크 오류', 'error'); return; }
    } else {
      await submitRequest('user_delete', deleteAuthUser.id, deleteAuthUser.email || '', '', deleteReason);
    }

    setDeleteAuthUser(null);
    setDeleteReason('');
  };

  // Approval actions (super_admin only)
  const handleApproveRequest = async (request: CredentialChangeRequest) => {
    if (!currentUserId) return;
    try {
      const res = await fetch(`${apiUrl}?action=approve-request`, {
        method: 'POST', headers: apiHeaders,
        body: JSON.stringify({ request_id: request.id, approver_id: currentUserId }),
      });
      const data = await res.json();
      if (data.error) { showToast('승인 실패: ' + data.error, 'error'); return; }
      logAction('UPDATE', 'credential_change_requests', request.id, { action: 'approved' });
      showToast('요청이 승인되었습니다.', 'success');
      loadRequests();
      loadAuthUsers();
    } catch { showToast('네트워크 오류', 'error'); }
  };

  const handleRejectRequest = async () => {
    if (!rejectDialog || !currentUserId) return;
    try {
      const res = await fetch(`${apiUrl}?action=reject-request`, {
        method: 'POST', headers: apiHeaders,
        body: JSON.stringify({ request_id: rejectDialog.id, approver_id: currentUserId, reason: rejectReason }),
      });
      const data = await res.json();
      if (data.error) { showToast('거절 실패: ' + data.error, 'error'); return; }
      logAction('UPDATE', 'credential_change_requests', rejectDialog.id, { action: 'rejected' });
      showToast('요청이 거절되었습니다.', 'success');
      setRejectDialog(null);
      setRejectReason('');
      loadRequests();
    } catch { showToast('네트워크 오류', 'error'); }
  };

  // Role actions
  const handleSaveRole = async () => {
    const payload = { user_id: roleForm.user_id, role: roleForm.role, display_name: roleForm.display_name };
    if (editingRole) {
      const { error } = await supabase.from('user_roles').update(payload).eq('id', editingRole.id);
      if (error) { showToast('수정 실패: ' + error.message, 'error'); return; }
      logAction('UPDATE', 'user_roles', editingRole.id, { role: payload.role });
      showToast('역할이 수정되었습니다.', 'success');
    } else {
      const { error } = await supabase.from('user_roles').insert(payload);
      if (error) { showToast('등록 실패: ' + error.message, 'error'); return; }
      logAction('CREATE', 'user_roles', undefined, { role: payload.role, display_name: payload.display_name });
      showToast('역할이 등록되었습니다.', 'success');
    }
    setRoleDialogOpen(false);
    loadRoles();
  };

  const handleDeleteRole = async () => {
    if (!deleteRoleTarget) return;
    const { error } = await supabase.from('user_roles').delete().eq('id', deleteRoleTarget.id);
    if (error) { showToast('삭제 실패', 'error'); return; }
    logAction('DELETE', 'user_roles', deleteRoleTarget.id, { display_name: deleteRoleTarget.display_name });
    showToast('삭제 완료', 'success');
    setDeleteRoleTarget(null);
    loadRoles();
  };

  const handleAddAssignment = async () => {
    if (!assignmentDialog) return;
    let permissions: Record<string, boolean> = {};
    try { permissions = JSON.parse(assignmentForm.permissions); } catch { showToast('권한 JSON 형식 오류', 'error'); return; }
    const payload = { user_id: assignmentDialog.user_id, complex_id: assignmentForm.complex_id, role_override: assignmentForm.role_override || null, permissions };
    const { error } = await supabase.from('user_complex_assignments').insert(payload);
    if (error) { showToast('단지 배정 실패: ' + error.message, 'error'); return; }
    showToast('단지 배정 완료', 'success');
    setAssignmentForm(emptyAssignmentForm);
    loadAssignments(assignmentDialog.user_id);
  };

  const handleDeleteAssignment = async (a: ComplexAssignment) => {
    const { error } = await supabase.from('user_complex_assignments').delete().eq('id', a.id);
    if (error) { showToast('삭제 실패', 'error'); return; }
    if (assignmentDialog) loadAssignments(assignmentDialog.user_id);
  };

  const getRoleLabel = (role: string) => ROLES.find(r => r.value === role)?.label || role;
  const getUserRole = (userId: string) => userRoles.find(ur => ur.user_id === userId);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const filteredAuthUsers = authUsers.filter(u =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase()) || u.id?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredRoles = userRoles.filter(ur =>
    !search || ur.display_name?.toLowerCase().includes(search.toLowerCase()) || ur.role?.toLowerCase().includes(search.toLowerCase()) || ur.user_id?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h1">사용자 관리</Typography>
          {isSuperAdmin && (
            <Chip label="최고 관리자 - 즉시 실행 가능" size="small" color="error" variant="outlined" sx={{ mt: 0.5 }} />
          )}
          {!isSuperAdmin && (
            <Chip label="변경 시 최고 관리자 승인 필요" size="small" color="warning" variant="outlined" sx={{ mt: 0.5 }} />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/team')}>팀원 관리</Button>
          <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setCreateUserDialog(true)}>회원 생성</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">전체 회원</Typography>
            <Typography variant="h2">{authUsers.length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">역할 배정</Typography>
            <Typography variant="h2">{userRoles.length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">승인 대기</Typography>
            <Typography variant="h2" color="warning.main">{pendingCount}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">최근 7일 접속</Typography>
            <Typography variant="h2">{authUsers.filter(u => u.last_sign_in_at && (Date.now() - new Date(u.last_sign_in_at).getTime()) < 7 * 24 * 60 * 60 * 1000).length}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}>
          <Tab label="회원 계정" />
          <Tab label={
            <Badge badgeContent={pendingCount} color="warning" sx={{ '& .MuiBadge-badge': { fontSize: 10, minWidth: 16, height: 16 } }}>
              <Box sx={{ pr: pendingCount > 0 ? 1.5 : 0 }}>승인 관리</Box>
            </Badge>
          } />
          <Tab label="역할 관리" />
        </Tabs>
        <TextField size="small" placeholder="이메일, 이름, ID 검색" value={search} onChange={e => setSearch(e.target.value)} sx={{ width: 280 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
      </Box>

      {/* Tab 0: Auth Users */}
      {tab === 0 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>이메일 (ID)</TableCell>
                  <TableCell>사용자 UUID</TableCell>
                  <TableCell>역할</TableCell>
                  <TableCell>최근 접속</TableCell>
                  <TableCell>가입일</TableCell>
                  <TableCell align="center">관리</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAuthUsers.map(u => {
                  const role = getUserRole(u.id);
                  return (
                    <TableRow key={u.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{u.email || '-'}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{u.id.slice(0, 8)}...</Typography></TableCell>
                      <TableCell>
                        {role ? <Chip label={getRoleLabel(role.role)} size="small" color={roleColorMap[role.role] || 'default'} /> : <Chip label="미배정" size="small" variant="outlined" />}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '없음'}
                        </Typography>
                      </TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary">{new Date(u.created_at).toLocaleDateString('ko-KR')}</Typography></TableCell>
                      <TableCell align="center">
                        <IconButton size="small" title="이메일 변경" onClick={() => { setEditEmailDialog(u); setEditEmailValue(u.email || ''); setEditEmailReason(''); }}>
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                        <IconButton size="small" title="비밀번호 재설정" onClick={() => { setResetPwDialog(u); setNewPassword(''); setResetPwReason(''); setShowPassword(false); }}>
                          <LockResetIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                        <IconButton size="small" title="삭제" onClick={() => { setDeleteAuthUser(u); setDeleteReason(''); }} sx={{ color: 'error.main' }}>
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredAuthUsers.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><Typography variant="body2" color="text.secondary">회원이 없습니다.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Tab 1: Approval Management */}
      {tab === 1 && (
        <Card>
          {!isSuperAdmin && (
            <Alert severity="info" sx={{ m: 2, fontSize: '0.75rem' }}>
              최고 관리자만 승인/거절할 수 있습니다. 여기에서 본인의 요청 상태를 확인할 수 있습니다.
            </Alert>
          )}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>요청 유형</TableCell>
                  <TableCell>대상 사용자</TableCell>
                  <TableCell>변경 내용</TableCell>
                  <TableCell>사유</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell>요청일</TableCell>
                  {isSuperAdmin && <TableCell align="center">처리</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {requests.map(r => {
                  const isExpired = new Date(r.expires_at) < new Date() && r.status === 'pending';
                  return (
                    <TableRow key={r.id} hover sx={{ opacity: isExpired ? 0.5 : 1 }}>
                      <TableCell><Chip label={changeTypeLabels[r.change_type] || r.change_type} size="small" variant="outlined" /></TableCell>
                      <TableCell><Typography variant="body2">{r.target_user_email || (r.target_user_id ? r.target_user_id.slice(0, 8) + '...' : '-')}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {r.change_type === 'email_change' ? `새 이메일: ${r.new_value}` :
                           r.change_type === 'password_reset' ? '비밀번호 변경 요청' :
                           r.change_type === 'user_create' ? `새 계정: ${r.target_user_email}` :
                           '계정 삭제 요청'}
                        </Typography>
                      </TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary">{r.reason || '-'}</Typography></TableCell>
                      <TableCell>
                        {isExpired
                          ? <Chip label="만료됨" size="small" color="default" />
                          : <Chip label={statusLabels[r.status]?.label || r.status} size="small" color={statusLabels[r.status]?.color || 'default'} />
                        }
                      </TableCell>
                      <TableCell><Typography variant="caption">{new Date(r.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Typography></TableCell>
                      {isSuperAdmin && (
                        <TableCell align="center">
                          {r.status === 'pending' && !isExpired && (
                            <>
                              <IconButton size="small" title="승인" onClick={() => handleApproveRequest(r)} sx={{ color: 'success.main' }}>
                                <CheckCircleIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                              <IconButton size="small" title="거절" onClick={() => { setRejectDialog(r); setRejectReason(''); }} sx={{ color: 'error.main' }}>
                                <CancelIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </>
                          )}
                          {r.status === 'approved' && <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />}
                          {r.status === 'rejected' && (
                            <Box>
                              <CancelIcon sx={{ fontSize: 16, color: 'error.main' }} />
                              {r.rejected_reason && <Typography variant="caption" color="error" sx={{ display: 'block' }}>{r.rejected_reason}</Typography>}
                            </Box>
                          )}
                          {isExpired && <PendingIcon sx={{ fontSize: 16, color: 'text.disabled' }} />}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {requests.length === 0 && (
                  <TableRow><TableCell colSpan={isSuperAdmin ? 7 : 6} align="center" sx={{ py: 4 }}><Typography variant="body2" color="text.secondary">승인 요청이 없습니다.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Tab 2: Roles */}
      {tab === 2 && (
        <>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => { setEditingRole(null); setRoleForm(emptyRoleForm); setRoleDialogOpen(true); }}>역할 등록</Button>
          </Box>
          <Card>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>이름</TableCell>
                    <TableCell>사용자 ID</TableCell>
                    <TableCell>역할</TableCell>
                    <TableCell>등록일</TableCell>
                    <TableCell align="center">관리</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRoles.map(ur => (
                    <TableRow key={ur.id} hover>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{ur.display_name}</Typography></TableCell>
                      <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{ur.user_id.slice(0, 8)}...</Typography></TableCell>
                      <TableCell><Chip label={getRoleLabel(ur.role)} size="small" color={roleColorMap[ur.role] || 'default'} /></TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary">{ur.created_at ? new Date(ur.created_at).toLocaleDateString('ko-KR') : '-'}</Typography></TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => { setAssignmentDialog(ur); loadAssignments(ur.user_id); }}><AssignmentIndIcon sx={{ fontSize: 16 }} /></IconButton>
                        <IconButton size="small" onClick={() => { setEditingRole(ur); setRoleForm({ user_id: ur.user_id, role: ur.role, display_name: ur.display_name }); setRoleDialogOpen(true); }}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                        <IconButton size="small" onClick={() => setDeleteRoleTarget(ur)} sx={{ color: 'error.main' }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRoles.length === 0 && (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><Typography variant="body2" color="text.secondary">역할이 없습니다.</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}

      {/* Create User Dialog */}
      {createUserDialog && (
        <Dialog open onClose={() => setCreateUserDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>회원 생성</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
            {!isSuperAdmin && (
              <Alert severity="warning" sx={{ fontSize: '0.75rem' }}>
                회원 생성은 최고 관리자의 승인 후 처리됩니다.
              </Alert>
            )}
            {isSuperAdmin && (
              <Alert severity="info" sx={{ fontSize: '0.75rem' }}>최고 관리자 권한으로 즉시 생성됩니다.</Alert>
            )}
            <TextField label="이메일 (로그인 ID)" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} fullWidth size="small" type="email" required />
            <TextField label="비밀번호" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} fullWidth size="small"
              type={showPassword ? 'text' : 'password'} required
              slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}</IconButton></InputAdornment> } }}
              helperText="6자 이상"
            />
            <TextField label="표시 이름 (선택)" value={createForm.display_name} onChange={e => setCreateForm({ ...createForm, display_name: e.target.value })} fullWidth size="small" />
            {!isSuperAdmin && (
              <TextField label="요청 사유" value={createForm.reason} onChange={e => setCreateForm({ ...createForm, reason: e.target.value })} fullWidth size="small" multiline rows={2} required />
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setCreateUserDialog(false)}>취소</Button>
            <Button variant="contained" onClick={handleCreateUser} disabled={!createForm.email || !createForm.password || createForm.password.length < 6 || (!isSuperAdmin && !createForm.reason)}>
              {isSuperAdmin ? '즉시 생성' : '승인 요청'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Edit Email Dialog */}
      {editEmailDialog && (
        <Dialog open onClose={() => setEditEmailDialog(null)} maxWidth="sm" fullWidth>
          <DialogTitle>이메일 (ID) 변경</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
            {!isSuperAdmin && (
              <Alert severity="warning" sx={{ fontSize: '0.75rem' }}>이메일 변경은 최고 관리자의 승인 후 처리됩니다.</Alert>
            )}
            {isSuperAdmin && (
              <Alert severity="info" sx={{ fontSize: '0.75rem' }}>최고 관리자 권한으로 즉시 변경됩니다.</Alert>
            )}
            <Typography variant="caption" color="text.secondary">현재 이메일</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>{editEmailDialog.email}</Typography>
            <TextField label="새 이메일" value={editEmailValue} onChange={e => setEditEmailValue(e.target.value)} fullWidth size="small" type="email" />
            {!isSuperAdmin && (
              <TextField label="변경 사유" value={editEmailReason} onChange={e => setEditEmailReason(e.target.value)} fullWidth size="small" multiline rows={2} required />
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setEditEmailDialog(null)}>취소</Button>
            <Button variant="contained" onClick={handleUpdateEmail} disabled={!editEmailValue || editEmailValue === editEmailDialog.email || (!isSuperAdmin && !editEmailReason)}>
              {isSuperAdmin ? '즉시 변경' : '승인 요청'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Reset Password Dialog */}
      {resetPwDialog && (
        <Dialog open onClose={() => setResetPwDialog(null)} maxWidth="sm" fullWidth>
          <DialogTitle>비밀번호 재설정</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
            {!isSuperAdmin && (
              <Alert severity="warning" sx={{ fontSize: '0.75rem' }}>비밀번호 변경은 최고 관리자의 승인 후 처리됩니다.</Alert>
            )}
            {isSuperAdmin && (
              <Alert severity="info" sx={{ fontSize: '0.75rem' }}>최고 관리자 권한으로 즉시 변경됩니다.</Alert>
            )}
            <Alert severity="info" sx={{ fontSize: '0.75rem' }}>대상: <strong>{resetPwDialog.email}</strong></Alert>
            <TextField label="새 비밀번호" value={newPassword} onChange={e => setNewPassword(e.target.value)} fullWidth size="small"
              type={showPassword ? 'text' : 'password'}
              slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}</IconButton></InputAdornment> } }}
              helperText="6자 이상 입력"
            />
            {!isSuperAdmin && (
              <TextField label="변경 사유" value={resetPwReason} onChange={e => setResetPwReason(e.target.value)} fullWidth size="small" multiline rows={2} required />
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setResetPwDialog(null)}>취소</Button>
            <Button variant="contained" color="warning" onClick={handleResetPassword} disabled={newPassword.length < 6 || (!isSuperAdmin && !resetPwReason)}>
              {isSuperAdmin ? '즉시 변경' : '승인 요청'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Delete Auth User Dialog */}
      {deleteAuthUser && (
        <Dialog open onClose={() => setDeleteAuthUser(null)} maxWidth="xs" fullWidth>
          <DialogTitle>회원 삭제</DialogTitle>
          <DialogContent>
            <Alert severity="error" sx={{ mb: 2, fontSize: '0.75rem' }}>이 작업은 되돌릴 수 없습니다.</Alert>
            {!isSuperAdmin && (
              <Alert severity="warning" sx={{ mb: 2, fontSize: '0.75rem' }}>회원 삭제는 최고 관리자의 승인 후 처리됩니다.</Alert>
            )}
            <Typography sx={{ mb: 2 }}>"{deleteAuthUser.email}" 회원을 삭제하시겠습니까?</Typography>
            {!isSuperAdmin && (
              <TextField label="삭제 사유" value={deleteReason} onChange={e => setDeleteReason(e.target.value)} fullWidth size="small" multiline rows={2} required />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteAuthUser(null)}>취소</Button>
            <Button variant="contained" color="error" onClick={handleDeleteAuthUser} disabled={!isSuperAdmin && !deleteReason}>
              {isSuperAdmin ? '즉시 삭제' : '승인 요청'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Reject Dialog */}
      {rejectDialog && (
        <Dialog open onClose={() => setRejectDialog(null)} maxWidth="sm" fullWidth>
          <DialogTitle>요청 거절</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
            <Typography variant="body2">
              <strong>{changeTypeLabels[rejectDialog.change_type]}</strong> 요청을 거절합니다.
            </Typography>
            <Typography variant="caption" color="text.secondary">대상: {rejectDialog.target_user_email || '-'}</Typography>
            <TextField label="거절 사유" value={rejectReason} onChange={e => setRejectReason(e.target.value)} fullWidth size="small" multiline rows={2} />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setRejectDialog(null)}>취소</Button>
            <Button variant="contained" color="error" onClick={handleRejectRequest}>거절</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Role Dialog */}
      {roleDialogOpen && (
        <Dialog open onClose={() => setRoleDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{editingRole ? '역할 수정' : '역할 등록'}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
            <TextField label="사용자 ID" value={roleForm.user_id} onChange={e => setRoleForm({ ...roleForm, user_id: e.target.value })} fullWidth size="small" required disabled={!!editingRole} />
            <TextField label="이름" value={roleForm.display_name} onChange={e => setRoleForm({ ...roleForm, display_name: e.target.value })} fullWidth size="small" required />
            <TextField label="역할" value={roleForm.role} onChange={e => setRoleForm({ ...roleForm, role: e.target.value })} fullWidth size="small" select required>
              {ROLES.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </TextField>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setRoleDialogOpen(false)}>취소</Button>
            <Button variant="contained" onClick={handleSaveRole} disabled={!roleForm.user_id || !roleForm.display_name}>{editingRole ? '수정' : '등록'}</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Delete Role Dialog */}
      {deleteRoleTarget && (
        <Dialog open onClose={() => setDeleteRoleTarget(null)} maxWidth="xs">
          <DialogTitle>역할 삭제</DialogTitle>
          <DialogContent><Typography>"{deleteRoleTarget.display_name}"의 역할을 삭제하시겠습니까?</Typography></DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteRoleTarget(null)}>취소</Button>
            <Button variant="contained" color="error" onClick={handleDeleteRole}>삭제</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Complex Assignment Dialog */}
      {assignmentDialog && (
        <Dialog open onClose={() => setAssignmentDialog(null)} maxWidth="sm" fullWidth>
          <DialogTitle>{assignmentDialog.display_name} - 단지 배정 관리</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1, mb: 2 }}>
              <Grid container spacing={1}>
                <Grid size={{ xs: 6 }}>
                  <TextField label="단지 ID" size="small" fullWidth value={assignmentForm.complex_id} onChange={e => setAssignmentForm({ ...assignmentForm, complex_id: e.target.value })} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField label="역할 재정의" size="small" fullWidth value={assignmentForm.role_override} onChange={e => setAssignmentForm({ ...assignmentForm, role_override: e.target.value })} />
                </Grid>
              </Grid>
              <TextField label="권한 (JSON)" size="small" fullWidth value={assignmentForm.permissions} onChange={e => setAssignmentForm({ ...assignmentForm, permissions: e.target.value })} multiline rows={2} />
              <Button variant="contained" size="small" onClick={handleAddAssignment} disabled={!assignmentForm.complex_id} sx={{ alignSelf: 'flex-end' }}>배정 추가</Button>
            </Box>
            <Divider sx={{ mb: 1 }} />
            {assignments.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>배정된 단지가 없습니다.</Typography>
            )}
            {assignments.map(a => (
              <Box key={a.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.complex_id}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {a.role_override ? `역할: ${a.role_override}` : '기본 역할'} | {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString('ko-KR') : '-'}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => handleDeleteAssignment(a)} sx={{ color: 'error.main' }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton>
              </Box>
            ))}
          </DialogContent>
          <DialogActions><Button onClick={() => setAssignmentDialog(null)}>닫기</Button></DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

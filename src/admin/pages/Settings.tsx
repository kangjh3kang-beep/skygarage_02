import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import EditIcon from '@mui/icons-material/Edit';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoIcon from '@mui/icons-material/Info';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../contexts/ToastContext';
import { useAuditLog } from '../../hooks/useAuditLog';

interface AdminSetting {
  id: string;
  key: string;
  value: string;
  description: string;
  category: string;
  is_sensitive: boolean;
  updated_at: string;
}

export default function Settings() {
  useDocumentTitle('설정');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { logAction } = useAuditLog();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [editDialog, setEditDialog] = useState<AdminSetting | null>(null);
  const [editValue, setEditValue] = useState('');
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);

  const loadData = useCallback(async () => {
    const [settingsRes, sessionRes] = await Promise.all([
      supabase.from('admin_settings').select('*').order('category').order('key'),
      supabase.auth.getSession(),
    ]);
    if (settingsRes.data) setSettings(settingsRes.data);
    if (sessionRes.data?.session?.user) setUser(sessionRes.data.session.user);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('settings-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_settings' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const handleSave = useCallback(async () => {
    if (!editDialog) return;
    const { error } = await supabase.from('admin_settings').update({ value: editValue, updated_at: new Date().toISOString() }).eq('id', editDialog.id);
    if (error) { showToast('저장 실패: ' + error.message, 'error'); return; }
    logAction('UPDATE', 'admin_settings', editDialog.id, { key: editDialog.key });
    showToast('설정이 저장되었습니다.', 'success');
    setEditDialog(null);
    loadData();
  }, [editDialog, editValue, showToast, logAction, loadData]);

  const handleToggle = useCallback(async (setting: AdminSetting) => {
    const newVal = setting.value === 'true' ? 'false' : 'true';
    const { error } = await supabase.from('admin_settings').update({ value: newVal, updated_at: new Date().toISOString() }).eq('id', setting.id);
    if (error) { showToast('변경 실패', 'error'); return; }
    logAction('UPDATE', 'admin_settings', setting.id, { key: setting.key, value: newVal });
    loadData();
  }, [showToast, logAction, loadData]);

  const categories = [...new Set(settings.map(s => s.category).filter(Boolean))];
  const isBoolSetting = (s: AdminSetting) => s.value === 'true' || s.value === 'false';

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h1">설정</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/users')}>사용자 관리</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/security')}>보안 감사</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/images')}>이미지 관리</Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card><CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}><InfoIcon color="primary" /><Typography variant="subtitle2">시스템 정보</Typography></Box>
            <Divider sx={{ mb: 1 }} />
            <Typography variant="caption" color="text.secondary">현재 사용자</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>{user?.email || '-'}</Typography>
            <Typography variant="caption" color="text.secondary">사용자 ID</Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block', mb: 1 }}>{user?.id || '-'}</Typography>
            <Typography variant="caption" color="text.secondary">설정 항목 수</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{settings.length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card><CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}><SettingsIcon color="primary" /><Typography variant="subtitle2">빠른 토글</Typography></Box>
            <Divider sx={{ mb: 1 }} />
            {settings.filter(isBoolSetting).slice(0, 6).map(s => (
              <Box key={s.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                <Box>
                  <Typography variant="body2">{s.key}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.description}</Typography>
                </Box>
                <Switch checked={s.value === 'true'} onChange={() => handleToggle(s)} size="small" />
              </Box>
            ))}
            {settings.filter(isBoolSetting).length === 0 && <Typography variant="caption" color="text.secondary">토글 설정이 없습니다.</Typography>}
          </CardContent></Card>
        </Grid>
      </Grid>

      {categories.length > 0 ? categories.map(cat => (
        <Card key={cat} sx={{ mb: 2 }}>
          <CardContent sx={{ pb: 0 }}>
            <Typography variant="subtitle2" color="primary">{cat}</Typography>
          </CardContent>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>키</TableCell><TableCell>값</TableCell><TableCell>설명</TableCell><TableCell>수정일</TableCell><TableCell align="center">관리</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {settings.filter(s => s.category === cat).map(s => (
                  <TableRow key={s.id} hover>
                    <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{s.key}</Typography></TableCell>
                    <TableCell>
                      {s.is_sensitive ? <Chip label="***" size="small" /> : isBoolSetting(s) ? <Chip label={s.value} size="small" color={s.value === 'true' ? 'success' : 'default'} /> : <Typography variant="body2">{s.value}</Typography>}
                    </TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">{s.description || '-'}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{s.updated_at ? new Date(s.updated_at).toLocaleString('ko-KR') : '-'}</Typography></TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => { setEditDialog(s); setEditValue(s.is_sensitive ? '' : s.value); }}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )) : (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>키</TableCell><TableCell>값</TableCell><TableCell>설명</TableCell><TableCell>수정일</TableCell><TableCell align="center">관리</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {settings.map(s => (
                  <TableRow key={s.id} hover>
                    <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{s.key}</Typography></TableCell>
                    <TableCell>{s.is_sensitive ? <Chip label="***" size="small" /> : <Typography variant="body2">{s.value}</Typography>}</TableCell>
                    <TableCell><Typography variant="caption">{s.description || '-'}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{s.updated_at ? new Date(s.updated_at).toLocaleString('ko-KR') : '-'}</Typography></TableCell>
                    <TableCell align="center"><IconButton size="small" onClick={() => { setEditDialog(s); setEditValue(s.is_sensitive ? '' : s.value); }}><EditIcon sx={{ fontSize: 16 }} /></IconButton></TableCell>
                  </TableRow>
                ))}
                {settings.length === 0 && <TableRow><TableCell colSpan={5} align="center"><Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>설정 항목이 없습니다.</Typography></TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {editDialog && (
        <Dialog open onClose={() => setEditDialog(null)} maxWidth="sm" fullWidth>
          <DialogTitle>설정 수정</DialogTitle>
          <DialogContent sx={{ pt: '16px !important' }}>
            <Typography variant="caption" color="text.secondary">키</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 2 }}>{editDialog.key}</Typography>
            {editDialog.description && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>{editDialog.description}</Typography>}
            <TextField label="값" value={editValue} onChange={e => setEditValue(e.target.value)} fullWidth size="small" multiline rows={isBoolSetting(editDialog) ? 1 : 3}
              type={editDialog.is_sensitive ? 'password' : 'text'} />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setEditDialog(null)}>취소</Button>
            <Button variant="contained" onClick={handleSave}>저장</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

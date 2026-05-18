import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import AddIcon from '@mui/icons-material/Add';
import CancelIcon from '@mui/icons-material/Cancel';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useVisitors } from '../../hooks/useVisitors';
import { useActiveParking } from '../../hooks/useActiveParking';

export default function VisitorManagement() {
  const { visitors, activeVisitors, loading, registerVisitor, cancelVisitor } = useVisitors();
  const { visitorSessions } = useActiveParking();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({
    plate_number: '',
    visitor_name: '',
    visitor_phone: '',
    visit_purpose: '',
    free_hours_granted: 2,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.plate_number) return;
    setSubmitting(true);
    await registerVisitor({
      plate_number: form.plate_number,
      visitor_name: form.visitor_name,
      visitor_phone: form.visitor_phone,
      visit_purpose: form.visit_purpose,
      free_hours_granted: form.free_hours_granted,
      status: 'pending',
    });
    setDialogOpen(false);
    setForm({ plate_number: '', visitor_name: '', visitor_phone: '', visit_purpose: '', free_hours_granted: 2 });
    setSubmitting(false);
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending': return { label: '대기', color: 'warning' as const };
      case 'active': return { label: '입차완료', color: 'success' as const };
      case 'completed': return { label: '출차완료', color: 'default' as const };
      case 'cancelled': return { label: '취소', color: 'error' as const };
      default: return { label: status, color: 'default' as const };
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 2.5 }}>
        {[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={72} sx={{ mb: 1.5, borderRadius: 2 }} />)}
      </Box>
    );
  }

  const displayedVisitors = tab === 0 ? activeVisitors : visitors.filter(v => v.status === 'completed' || v.status === 'cancelled');

  return (
    <Box sx={{ p: 2.5, maxWidth: 520, mx: 'auto' }}>
      {/* Active Visitor Vehicles */}
      {visitorSessions.length > 0 && (
        <Card sx={{ mb: 2, border: '1px solid', borderColor: 'info.main', bgcolor: 'action.hover' }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" sx={{ color: 'info.main', fontWeight: 700, mb: 1, display: 'block', letterSpacing: 0.3 }}>
              현재 주차 중인 방문 차량
            </Typography>
            {visitorSessions.map(session => (
              <Box key={session.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{session.vehicle_plate}</Typography>
                <Chip size="small" label={session.entry_method === 'direct_entry' ? '세대직입' : '발렛'} sx={{ fontSize: '0.65rem', height: 20 }} />
                <Box sx={{ flex: 1 }} />
                <AccessTimeIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  {new Date(session.entry_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabs + Register Button */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ flex: 1, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: '0.8rem' } }}>
          <Tab label={`등록현황 (${activeVisitors.length})`} />
          <Tab label="이력" />
        </Tabs>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)} sx={{ ml: 1, fontSize: '0.75rem' }}>
          등록
        </Button>
      </Box>

      {/* Visitor List */}
      {displayedVisitors.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {tab === 0 ? '등록된 방문 차량이 없습니다.' : '방문 이력이 없습니다.'}
          </Typography>
          {tab === 0 && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setDialogOpen(true)}
              sx={{ mt: 2 }}
            >
              방문 차량 등록하기
            </Button>
          )}
        </Box>
      ) : (
        <List disablePadding>
          {displayedVisitors.map((v, idx) => {
            const s = statusLabel(v.status);
            return (
              <Box key={v.id}>
                {idx > 0 && <Divider />}
                <ListItem
                  disablePadding
                  sx={{ py: 1.5 }}
                  secondaryAction={
                    v.status === 'pending' ? (
                      <IconButton edge="end" onClick={() => cancelVisitor(v.id)} size="small" title="취소">
                        <CancelIcon fontSize="small" color="error" />
                      </IconButton>
                    ) : undefined
                  }
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{v.plate_number}</Typography>
                        <Chip label={s.label} size="small" color={s.color} sx={{ fontSize: '0.65rem', height: 20 }} />
                        <Chip label={`${v.free_hours_granted}시간`} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                      </Box>
                    }
                    secondary={`${v.visitor_name}${v.visit_purpose ? ` - ${v.visit_purpose}` : ''}`}
                    slotProps={{ secondary: { sx: { fontSize: '0.7rem', mt: 0.3 } } }}
                  />
                </ListItem>
              </Box>
            );
          })}
        </List>
      )}

      {/* Registration Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>방문 차량 사전 등록</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="차량 번호"
            placeholder="12가 3456"
            value={form.plate_number}
            onChange={e => setForm(prev => ({ ...prev, plate_number: e.target.value }))}
            fullWidth
            required
            size="small"
          />
          <TextField
            label="방문자 이름"
            value={form.visitor_name}
            onChange={e => setForm(prev => ({ ...prev, visitor_name: e.target.value }))}
            fullWidth
            size="small"
          />
          <TextField
            label="연락처"
            value={form.visitor_phone}
            onChange={e => setForm(prev => ({ ...prev, visitor_phone: e.target.value }))}
            fullWidth
            size="small"
          />
          <TextField
            label="방문 목적"
            value={form.visit_purpose}
            onChange={e => setForm(prev => ({ ...prev, visit_purpose: e.target.value }))}
            fullWidth
            size="small"
          />
          <TextField
            label="무료 주차 시간 (시간)"
            type="number"
            value={form.free_hours_granted}
            onChange={e => setForm(prev => ({ ...prev, free_hours_granted: Number(e.target.value) }))}
            slotProps={{ htmlInput: { min: 0, max: 24 } }}
            fullWidth
            size="small"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} size="small">취소</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!form.plate_number || submitting} size="small">
            등록
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

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
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import { useBilling } from '../../hooks/useBilling';

export default function BillingPage() {
  const { records, paymentMethods, loading, pendingAmount, addPaymentMethod, setDefaultMethod, deletePaymentMethod } = useBilling();
  const [tab, setTab] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ method_type: 'credit_card', card_last_four: '', card_brand: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleAddMethod = async () => {
    setSubmitting(true);
    await addPaymentMethod(form as Parameters<typeof addPaymentMethod>[0]);
    setDialogOpen(false);
    setForm({ method_type: 'credit_card', card_last_four: '', card_brand: '' });
    setSubmitting(false);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success' as const;
      case 'pending': return 'warning' as const;
      case 'overdue': return 'error' as const;
      default: return 'default' as const;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'parking_overage': return '주차 초과';
      case 'ev_charging': return 'EV 충전';
      case 'monthly_fee': return '월정액';
      default: return type;
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 2.5 }}>
        {[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={72} sx={{ mb: 1.5, borderRadius: 2 }} />)}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2.5, maxWidth: 520, mx: 'auto' }}>
      {/* Summary */}
      <Card sx={{ mb: 2, bgcolor: pendingAmount > 0 ? 'error.dark' : 'success.dark', border: 'none' }}>
        <CardContent sx={{ textAlign: 'center', py: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 }}>미결제 금액</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#fff', my: 0.5 }}>
            {pendingAmount.toLocaleString()}원
          </Typography>
          {pendingAmount > 0 && (
            <Button variant="contained" size="small" sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}>
              결제하기
            </Button>
          )}
        </CardContent>
      </Card>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: '0.8rem' } }}>
        <Tab label="이용 내역" icon={<ReceiptIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
        <Tab label="결제 수단" icon={<CreditCardIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
      </Tabs>

      {/* Billing Records */}
      {tab === 0 && (
        <List disablePadding>
          {records.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 6 }}>
              이용 내역이 없습니다.
            </Typography>
          ) : (
            records.map((r, idx) => (
              <Box key={r.id}>
                {idx > 0 && <Divider />}
                <ListItem disablePadding sx={{ py: 1.5 }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{r.description || typeLabel(r.record_type)}</Typography>
                        <Chip
                          label={r.status === 'paid' ? '결제완료' : r.status === 'overdue' ? '연체' : '미결제'}
                          size="small"
                          color={statusColor(r.status)}
                          sx={{ fontSize: '0.65rem', height: 20 }}
                        />
                      </Box>
                    }
                    secondary={new Date(r.billing_date).toLocaleDateString('ko-KR')}
                    slotProps={{ secondary: { sx: { fontSize: '0.7rem' } } }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {r.amount.toLocaleString()}원
                  </Typography>
                </ListItem>
              </Box>
            ))
          )}
        </List>
      )}

      {/* Payment Methods */}
      {tab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
            <Button size="small" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)} sx={{ fontSize: '0.75rem' }}>
              추가
            </Button>
          </Box>
          <List disablePadding>
            {paymentMethods.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 6 }}>
                등록된 결제 수단이 없습니다.
              </Typography>
            ) : (
              paymentMethods.map((m, idx) => (
                <Box key={m.id}>
                  {idx > 0 && <Divider />}
                  <ListItem
                    disablePadding
                    sx={{ py: 1.5 }}
                    secondaryAction={
                      <Box>
                        {!m.is_default && (
                          <IconButton size="small" onClick={() => setDefaultMethod(m.id)} title="기본 설정">
                            <StarIcon fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton size="small" onClick={() => deletePaymentMethod(m.id)} title="삭제">
                          <DeleteIcon fontSize="small" color="error" />
                        </IconButton>
                      </Box>
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CreditCardIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {m.card_brand} **** {m.card_last_four}
                          </Typography>
                          {m.is_default && <Chip label="기본" size="small" color="primary" sx={{ fontSize: '0.65rem', height: 20 }} />}
                        </Box>
                      }
                      secondary={m.is_auto_pay ? '자동 결제 설정됨' : '수동 결제'}
                      slotProps={{ secondary: { sx: { fontSize: '0.7rem' } } }}
                    />
                  </ListItem>
                </Box>
              ))
            )}
          </List>
        </Box>
      )}

      {/* Add Payment Method Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>결제 수단 추가</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <FormControl fullWidth size="small">
            <InputLabel>결제 유형</InputLabel>
            <Select
              value={form.method_type}
              label="결제 유형"
              onChange={e => setForm(prev => ({ ...prev, method_type: e.target.value }))}
            >
              <MenuItem value="credit_card">신용카드</MenuItem>
              <MenuItem value="bank_transfer">계좌이체</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="카드사/은행"
            value={form.card_brand}
            onChange={e => setForm(prev => ({ ...prev, card_brand: e.target.value }))}
            fullWidth
            size="small"
          />
          <TextField
            label="끝 4자리"
            value={form.card_last_four}
            onChange={e => setForm(prev => ({ ...prev, card_last_four: e.target.value }))}
            slotProps={{ htmlInput: { maxLength: 4 } }}
            fullWidth
            size="small"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} size="small">취소</Button>
          <Button variant="contained" onClick={handleAddMethod} disabled={!form.card_last_four || submitting} size="small">
            추가
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

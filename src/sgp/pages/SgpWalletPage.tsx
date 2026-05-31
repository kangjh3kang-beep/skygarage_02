import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddIcon from '@mui/icons-material/Add';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { supabase } from '../../lib/supabase';
import type { SgpCoinTransaction } from '../types';

const CHARGE_AMOUNTS = [5000, 10000, 30000, 50000, 100000];

export default function SgpWalletPage() {
  const { user, wallet, refreshWallet } = useSgpAuth();
  const [transactions, setTransactions] = useState<SgpCoinTransaction[]>([]);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(10000);
  const [charging, setCharging] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('sgp_coin_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setTransactions(data || []));
  }, [user]);

  const handleCharge = async () => {
    if (!user || !wallet) return;
    setCharging(true);

    const newBalance = wallet.balance + selectedAmount;

    const { error: txError } = await supabase.from('sgp_coin_transactions').insert({
      wallet_id: wallet.id,
      user_id: user.id,
      type: 'charge',
      amount: selectedAmount,
      balance_after: newBalance,
      description: `코인 충전 ${selectedAmount.toLocaleString()}C`,
      reference_type: 'manual',
    });

    if (!txError) {
      await supabase
        .from('sgp_coin_wallets')
        .update({
          balance: newBalance,
          lifetime_charged: wallet.lifetime_charged + selectedAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id);

      await refreshWallet();
      const { data } = await supabase
        .from('sgp_coin_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setTransactions(data || []);
    }

    setCharging(false);
    setChargeOpen(false);
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Balance Card */}
      <Card sx={{ background: 'linear-gradient(135deg, #1a2d42 0%, #0d1b2a 100%)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AccountBalanceWalletIcon sx={{ color: '#00d4aa' }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>내 코인 잔액</Typography>
          </Box>
          <Typography variant="h3" sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
            {(wallet?.balance || 0).toLocaleString()}
            <Typography component="span" variant="h6" sx={{ color: 'rgba(255,255,255,0.5)', ml: 1 }}>C</Typography>
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>누적 충전</Typography>
              <Typography variant="body2" sx={{ color: '#4caf50', fontWeight: 600 }}>
                +{(wallet?.lifetime_charged || 0).toLocaleString()} C
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>누적 사용</Typography>
              <Typography variant="body2" sx={{ color: '#ff7043', fontWeight: 600 }}>
                -{(wallet?.lifetime_spent || 0).toLocaleString()} C
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            fullWidth
            onClick={() => setChargeOpen(true)}
            sx={{ mt: 3, py: 1.2, fontWeight: 700, bgcolor: '#00d4aa', color: '#0d1b2a', '&:hover': { bgcolor: '#00b894' } }}
          >
            코인 충전
          </Button>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, mb: 1.5 }}>거래 내역</Typography>
      {transactions.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', py: 4 }}>
          거래 내역이 없습니다
        </Typography>
      ) : (
        transactions.map((tx, idx) => (
          <Box key={tx.id}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5 }}>
              {tx.type === 'charge' || tx.type === 'refund' || tx.type === 'bonus' ? (
                <TrendingUpIcon sx={{ color: '#4caf50', fontSize: 20 }} />
              ) : (
                <TrendingDownIcon sx={{ color: '#ff7043', fontSize: 20 }} />
              )}
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>{tx.description}</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                  {new Date(tx.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" sx={{ color: tx.type === 'payment' ? '#ff7043' : '#4caf50', fontWeight: 700 }}>
                  {tx.type === 'payment' ? '-' : '+'}{Math.abs(tx.amount).toLocaleString()} C
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>
                  잔액 {tx.balance_after.toLocaleString()}
                </Typography>
              </Box>
            </Box>
            {idx < transactions.length - 1 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />}
          </Box>
        ))
      )}

      {/* Charge Dialog */}
      <Dialog open={chargeOpen} onClose={() => setChargeOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { bgcolor: '#1a2d42', color: '#fff' } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>코인 충전</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 2 }}>충전할 금액을 선택하세요</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {CHARGE_AMOUNTS.map(amount => (
              <Chip
                key={amount}
                label={`${amount.toLocaleString()} C`}
                onClick={() => setSelectedAmount(amount)}
                sx={{
                  bgcolor: selectedAmount === amount ? 'rgba(0,212,170,0.2)' : 'rgba(255,255,255,0.05)',
                  color: selectedAmount === amount ? '#00d4aa' : 'rgba(255,255,255,0.7)',
                  border: selectedAmount === amount ? '1px solid #00d4aa' : '1px solid rgba(255,255,255,0.1)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              />
            ))}
          </Box>
          <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>충전 금액</Typography>
              <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>{selectedAmount.toLocaleString()} C</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>결제 금액</Typography>
              <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>{selectedAmount.toLocaleString()} 원</Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setChargeOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)' }}>취소</Button>
          <Button
            variant="contained"
            onClick={handleCharge}
            disabled={charging}
            sx={{ bgcolor: '#00d4aa', color: '#0d1b2a', fontWeight: 700, '&:hover': { bgcolor: '#00b894' } }}
          >
            {charging ? '처리중...' : '충전하기'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import NfcIcon from '@mui/icons-material/Nfc';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { supabase } from '../../lib/supabase';

type PaymentState = 'idle' | 'scanning' | 'success' | 'error';

export default function SgpPayPage() {
  const { user, wallet, refreshWallet } = useSgpAuth();
  const [state, setState] = useState<PaymentState>('idle');
  const [message, setMessage] = useState('');
  const [nfcSupported] = useState(() => 'NDEFReader' in window);

  const startNfcScan = async () => {
    if (!user || !wallet) return;

    if (!nfcSupported) {
      setState('error');
      setMessage('이 기기는 NFC를 지원하지 않습니다. NFC 기능이 있는 스마트폰에서 이용해주세요.');
      return;
    }

    setState('scanning');
    setMessage('결제 단말기에 휴대폰을 태그하세요');

    try {
      const ndef = new (window as unknown as { NDEFReader: new () => NDEFReaderInstance }).NDEFReader();
      await ndef.scan();

      ndef.onreading = async (event: NDEFReadingEvent) => {
        const terminalId = extractTerminalId(event);
        await processPayment(terminalId);
      };

      ndef.onreadingerror = () => {
        setState('error');
        setMessage('NFC 읽기에 실패했습니다. 다시 시도해주세요.');
      };
    } catch (err) {
      setState('error');
      setMessage(`NFC 활성화 실패: ${(err as Error).message}`);
    }
  };

  const extractTerminalId = (event: NDEFReadingEvent): string => {
    if (event.message?.records?.length > 0) {
      const record = event.message.records[0];
      if (record.recordType === 'text') {
        const decoder = new TextDecoder();
        return decoder.decode(record.data);
      }
    }
    return `TERM-${event.serialNumber || 'UNKNOWN'}`;
  };

  const processPayment = async (terminalId: string) => {
    if (!user || !wallet) return;

    const parkingFee = 0;

    const { error } = await supabase.from('sgp_parking_payments').insert({
      user_id: user.id,
      complex_id: null,
      vehicle_plate: 'NFC-TAG',
      entry_at: new Date().toISOString(),
      amount_coins: parkingFee,
      payment_method: 'nfc_tag',
      nfc_terminal_id: terminalId,
      status: 'completed',
    });

    if (error) {
      setState('error');
      setMessage('결제 처리에 실패했습니다.');
    } else {
      setState('success');
      setMessage(`결제가 완료되었습니다. 단말기: ${terminalId}`);
      await refreshWallet();
    }
  };

  const simulatePayment = async () => {
    if (!user || !wallet) return;
    setState('scanning');
    setMessage('결제 처리중...');

    await new Promise(r => setTimeout(r, 1500));

    const fee = 2000;
    if (wallet.balance < fee) {
      setState('error');
      setMessage('잔액이 부족합니다. 코인을 충전해주세요.');
      return;
    }

    const newBalance = wallet.balance - fee;

    const { error: txError } = await supabase.from('sgp_coin_transactions').insert({
      wallet_id: wallet.id,
      user_id: user.id,
      type: 'payment',
      amount: fee,
      balance_after: newBalance,
      description: '주차 요금 결제 (NFC)',
      reference_type: 'parking',
      reference_id: crypto.randomUUID(),
    });

    if (!txError) {
      await supabase
        .from('sgp_coin_wallets')
        .update({
          balance: newBalance,
          lifetime_spent: wallet.lifetime_spent + fee,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id);

      await supabase.from('sgp_parking_payments').insert({
        user_id: user.id,
        complex_id: '00000000-0000-0000-0000-000000000000',
        vehicle_plate: 'SIM-0000',
        amount_coins: fee,
        payment_method: 'nfc_tag',
        nfc_terminal_id: 'SIM-TERMINAL-001',
        status: 'completed',
        duration_minutes: 120,
      });

      await refreshWallet();
      setState('success');
      setMessage(`결제 완료: ${fee.toLocaleString()} C 차감`);
    } else {
      setState('error');
      setMessage('결제 처리 실패');
    }
  };

  const reset = () => {
    setState('idle');
    setMessage('');
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1, textAlign: 'center' }}>
        NFC 결제
      </Typography>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 3, textAlign: 'center' }}>
        입출차 단말기에 휴대폰을 태그하여 결제하세요
      </Typography>

      {/* Balance */}
      <Card sx={{ width: '100%', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, mb: 3 }}>
        <CardContent sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AccountBalanceWalletIcon sx={{ color: '#00d4aa' }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>사용 가능 잔액</Typography>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
              {(wallet?.balance || 0).toLocaleString()} C
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* NFC Area */}
      <Box
        sx={{
          width: 220,
          height: 220,
          borderRadius: '50%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: state === 'scanning' ? '3px solid #00d4aa' : state === 'success' ? '3px solid #4caf50' : state === 'error' ? '3px solid #f44336' : '3px solid rgba(255,255,255,0.15)',
          bgcolor: state === 'scanning' ? 'rgba(0,212,170,0.05)' : 'rgba(255,255,255,0.02)',
          transition: 'all 0.3s ease',
          animation: state === 'scanning' ? 'pulse 1.5s infinite' : 'none',
          mb: 3,
          cursor: state === 'idle' ? 'pointer' : 'default',
          '@keyframes pulse': {
            '0%': { boxShadow: '0 0 0 0 rgba(0,212,170,0.4)' },
            '70%': { boxShadow: '0 0 0 20px rgba(0,212,170,0)' },
            '100%': { boxShadow: '0 0 0 0 rgba(0,212,170,0)' },
          },
        }}
        onClick={state === 'idle' ? startNfcScan : undefined}
      >
        {state === 'success' ? (
          <CheckCircleIcon sx={{ fontSize: 64, color: '#4caf50' }} />
        ) : state === 'error' ? (
          <ErrorIcon sx={{ fontSize: 64, color: '#f44336' }} />
        ) : (
          <NfcIcon sx={{ fontSize: 64, color: state === 'scanning' ? '#00d4aa' : 'rgba(255,255,255,0.4)' }} />
        )}
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mt: 1, textAlign: 'center', px: 2 }}>
          {state === 'idle' && '탭하여 NFC 시작'}
          {state === 'scanning' && '태그 대기중...'}
          {state === 'success' && '완료'}
          {state === 'error' && '오류'}
        </Typography>
      </Box>

      {message && (
        <Alert
          severity={state === 'success' ? 'success' : state === 'error' ? 'error' : 'info'}
          sx={{ width: '100%', mb: 2 }}
        >
          {message}
        </Alert>
      )}

      {(state === 'success' || state === 'error') && (
        <Button
          variant="outlined"
          onClick={reset}
          sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', mb: 2 }}
        >
          다시 시도
        </Button>
      )}

      {!nfcSupported && state === 'idle' && (
        <Button
          variant="contained"
          onClick={simulatePayment}
          sx={{ bgcolor: '#00d4aa', color: '#0d1b2a', fontWeight: 700, '&:hover': { bgcolor: '#00b894' } }}
        >
          결제 시뮬레이션 (테스트)
        </Button>
      )}
    </Box>
  );
}

interface NDEFReaderInstance {
  scan(): Promise<void>;
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onreadingerror: (() => void) | null;
}

interface NDEFReadingEvent {
  serialNumber: string;
  message: {
    records: Array<{
      recordType: string;
      data: ArrayBuffer;
    }>;
  };
}

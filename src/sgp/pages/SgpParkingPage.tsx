import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { supabase } from '../../lib/supabase';
import type { SgpParkingPayment } from '../types';

export default function SgpParkingPage() {
  const { user } = useSgpAuth();
  const [tab, setTab] = useState(0);
  const [payments, setPayments] = useState<SgpParkingPayment[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('sgp_parking_payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setPayments(data || []));
  }, [user]);

  const activePayments = payments.filter(p => p.status === 'pending');
  const completedPayments = payments.filter(p => p.status === 'completed');

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 2 }}>
        주차 내역
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 2,
          '& .MuiTab-root': { color: 'rgba(255,255,255,0.5)', minHeight: 40, fontSize: '0.8rem' },
          '& .Mui-selected': { color: '#00d4aa' },
          '& .MuiTabs-indicator': { bgcolor: '#00d4aa' },
        }}
      >
        <Tab label={`주차중 (${activePayments.length})`} />
        <Tab label={`완료 (${completedPayments.length})`} />
      </Tabs>

      {tab === 0 && (
        activePayments.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <DirectionsCarIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 1 }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>현재 주차중인 차량이 없습니다</Typography>
          </Box>
        ) : (
          activePayments.map(p => (
            <ParkingCard key={p.id} payment={p} />
          ))
        )
      )}

      {tab === 1 && (
        completedPayments.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>이용내역이 없습니다</Typography>
          </Box>
        ) : (
          completedPayments.map(p => (
            <ParkingCard key={p.id} payment={p} />
          ))
        )
      )}
    </Box>
  );
}

function ParkingCard({ payment }: { payment: SgpParkingPayment }) {
  const statusColor = payment.status === 'pending' ? '#ff9800' : '#4caf50';

  return (
    <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, mb: 1.5 }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DirectionsCarIcon sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 20 }} />
            <Typography variant="body1" sx={{ color: '#fff', fontWeight: 700 }}>{payment.vehicle_plate}</Typography>
          </Box>
          <Chip
            label={payment.status === 'pending' ? '주차중' : '완료'}
            size="small"
            sx={{ bgcolor: `${statusColor}20`, color: statusColor, fontSize: '0.7rem', height: 22 }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AccessTimeIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              {new Date(payment.entry_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
          {payment.duration_minutes > 0 && (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              {payment.duration_minutes}분
            </Typography>
          )}
          {payment.amount_coins > 0 && (
            <Typography variant="caption" sx={{ color: '#00d4aa', fontWeight: 600 }}>
              {payment.amount_coins.toLocaleString()} C
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import NfcIcon from '@mui/icons-material/Nfc';
import ApartmentIcon from '@mui/icons-material/Apartment';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import HistoryIcon from '@mui/icons-material/History';
import { useNavigate } from 'react-router-dom';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { supabase } from '../../lib/supabase';
import type { SgpComplexMembership, SgpParkingPayment } from '../types';

export default function SgpHomePage() {
  const { user, wallet } = useSgpAuth();
  const navigate = useNavigate();
  const [memberships, setMemberships] = useState<SgpComplexMembership[]>([]);
  const [recentPayments, setRecentPayments] = useState<SgpParkingPayment[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('sgp_complex_memberships')
      .select('*, complex:complexes(id, name, address)')
      .eq('user_id', user.id)
      .then(({ data }) => setMemberships(data || []));

    supabase
      .from('sgp_parking_payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setRecentPayments(data || []));
  }, [user]);

  const approvedMemberships = memberships.filter(m => m.request_status === 'approved');

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 0.5 }}>
        안녕하세요, {user?.display_name || '사용자'}님
      </Typography>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 3 }}>
        {user?.phone}
      </Typography>

      {/* Wallet Quick View */}
      <Card sx={{ bgcolor: 'linear-gradient(135deg, #1a2d42 0%, #0d1b2a 100%)', background: 'linear-gradient(135deg, #1a2d42 0%, #0d1b2a 100%)', border: '1px solid rgba(0,212,170,0.2)', mb: 2, borderRadius: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountBalanceWalletIcon sx={{ color: '#00d4aa', fontSize: 20 }} />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>코인 잔액</Typography>
            </Box>
            <Button size="small" onClick={() => navigate('/app/wallet')} sx={{ color: '#00d4aa', fontSize: '0.75rem' }}>
              충전하기
            </Button>
          </Box>
          <Typography variant="h4" sx={{ color: '#fff', fontWeight: 800 }}>
            {(wallet?.balance || 0).toLocaleString()} <Typography component="span" variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>C</Typography>
          </Typography>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 3 }}>
        <Card
          onClick={() => navigate('/app/pay')}
          sx={{ bgcolor: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', cursor: 'pointer', borderRadius: 2, '&:hover': { bgcolor: 'rgba(0,212,170,0.15)' } }}
        >
          <CardContent sx={{ p: 2, textAlign: 'center' }}>
            <NfcIcon sx={{ color: '#00d4aa', fontSize: 32, mb: 0.5 }} />
            <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>NFC 결제</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>태그하여 결제</Typography>
          </CardContent>
        </Card>
        <Card
          onClick={() => navigate('/app/parking')}
          sx={{ bgcolor: 'rgba(33,150,243,0.08)', border: '1px solid rgba(33,150,243,0.2)', cursor: 'pointer', borderRadius: 2, '&:hover': { bgcolor: 'rgba(33,150,243,0.15)' } }}
        >
          <CardContent sx={{ p: 2, textAlign: 'center' }}>
            <DirectionsCarIcon sx={{ color: '#2196f3', fontSize: 32, mb: 0.5 }} />
            <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>주차 현황</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>입출차 내역</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Complex Membership */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700 }}>
            소속 단지/건물
          </Typography>
          <Button size="small" onClick={() => navigate('/app/profile')} sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>
            관리
          </Button>
        </Box>
        {approvedMemberships.length === 0 ? (
          <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <ApartmentIcon sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 32, mb: 1 }} />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                등록된 단지가 없습니다
              </Typography>
              <Button size="small" onClick={() => navigate('/app/profile')} sx={{ mt: 1, color: '#00d4aa', fontSize: '0.75rem' }}>
                단지 등록 신청
              </Button>
            </CardContent>
          </Card>
        ) : (
          approvedMemberships.map(m => (
            <Card key={m.id} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, mb: 1 }}>
              <CardContent sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <ApartmentIcon sx={{ color: '#2196f3', fontSize: 24 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                    {m.complex?.name || '단지'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                    {m.building_dong && `${m.building_dong}동 `}{m.unit_number}호
                  </Typography>
                </Box>
                <Chip label={m.role === 'owner' ? '소유자' : m.role === 'tenant' ? '세입자' : '입주민'} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(0,212,170,0.1)', color: '#00d4aa' }} />
              </CardContent>
            </Card>
          ))
        )}
      </Box>

      {/* Recent Activity */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <HistoryIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }} />
          <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700 }}>최근 이용내역</Typography>
        </Box>
        {recentPayments.length === 0 ? (
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>이용내역이 없습니다</Typography>
        ) : (
          recentPayments.map(p => (
            <Card key={p.id} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, mb: 1 }}>
              <CardContent sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <DirectionsCarIcon sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 20 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>{p.vehicle_plate}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                    {new Date(p.entry_at).toLocaleDateString('ko-KR')} | {p.duration_minutes}분
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#00d4aa', fontWeight: 700 }}>
                  -{p.amount_coins.toLocaleString()} C
                </Typography>
              </CardContent>
            </Card>
          ))
        )}
      </Box>
    </Box>
  );
}

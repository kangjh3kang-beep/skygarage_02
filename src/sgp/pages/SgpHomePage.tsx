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
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import MapIcon from '@mui/icons-material/Map';
import HistoryIcon from '@mui/icons-material/History';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { useNavigate } from 'react-router-dom';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { supabase } from '../../lib/supabase';
import type { SgpComplexMembership, SgpParkingPayment } from '../types';

export default function SgpHomePage() {
  const { user, wallet } = useSgpAuth();
  const navigate = useNavigate();
  const [memberships, setMemberships] = useState<SgpComplexMembership[]>([]);
  const [recentPayments, setRecentPayments] = useState<SgpParkingPayment[]>([]);
  const [activeParking, setActiveParking] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('sgp_complex_memberships')
      .select('*, complex:complexes(id, name, address)')
      .eq('user_id', user.id)
      .eq('request_status', 'approved')
      .then(({ data }) => setMemberships(data || []));

    supabase
      .from('sgp_parking_payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setRecentPayments(data || []);
        setActiveParking((data || []).filter(p => p.status === 'pending').length);
      });
  }, [user]);

  const greetingTime = () => {
    const h = new Date().getHours();
    if (h < 6) return '새벽에도';
    if (h < 12) return '좋은 아침이에요';
    if (h < 18) return '좋은 오후에요';
    return '좋은 저녁이에요';
  };

  return (
    <Box sx={{ pb: 2 }}>
      {/* Greeting Header */}
      <Box sx={{ px: 2.5, pt: 2, pb: 2.5 }}>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 0.3 }}>
          {greetingTime()},
        </Typography>
        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800, letterSpacing: '-0.5px' }}>
          {user?.display_name || '사용자'}님
        </Typography>
      </Box>

      {/* Wallet Card */}
      <Box sx={{ px: 2, mb: 2.5 }}>
        <Card
          onClick={() => navigate('/app/wallet')}
          sx={{
            background: 'linear-gradient(135deg, #1b3a52 0%, #0f2438 100%)',
            border: '1px solid rgba(0,212,170,0.15)',
            borderRadius: 4,
            cursor: 'pointer',
            transition: 'transform 0.2s',
            '&:active': { transform: 'scale(0.98)' },
          }}
        >
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <AccountBalanceWalletIcon sx={{ color: '#00d4aa', fontSize: 18 }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>잔액</Typography>
              </Box>
              <Button
                size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                onClick={(e) => { e.stopPropagation(); navigate('/app/wallet'); }}
                sx={{ color: '#00d4aa', fontSize: '0.7rem', minWidth: 0, p: '2px 8px' }}
              >
                충전
              </Button>
            </Box>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 800, letterSpacing: '-0.5px' }}>
              {(wallet?.balance || 0).toLocaleString()}
              <Typography component="span" variant="body1" sx={{ color: 'rgba(255,255,255,0.4)', ml: 0.5 }}>C</Typography>
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Quick Actions Grid */}
      <Box sx={{ px: 2, mb: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5 }}>
          {[
            { icon: <NfcIcon />, label: 'NFC결제', color: '#00d4aa', path: '/app/pay' },
            { icon: <MapIcon />, label: '내차위치', color: '#2196f3', path: '/app/map' },
            { icon: <LocalParkingIcon />, label: '빈주차면', color: '#26c6da', path: '/app/spots' },
            { icon: <DirectionsCarIcon />, label: '주차내역', color: '#ff9800', path: '/app/parking' },
          ].map(item => (
            <Box
              key={item.label}
              onClick={() => navigate(item.path)}
              sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8,
                p: 1.5, borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                '&:active': { transform: 'scale(0.95)', bgcolor: 'rgba(255,255,255,0.06)' },
              }}
            >
              <Box sx={{
                width: 36, height: 36, borderRadius: '10px',
                bgcolor: `${item.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                '& svg': { fontSize: 20, color: item.color },
              }}>
                {item.icon}
              </Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.68rem', fontWeight: 500 }}>
                {item.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Active Parking Status */}
      {activeParking > 0 && (
        <Box sx={{ px: 2, mb: 2.5 }}>
          <Card
            onClick={() => navigate('/app/map')}
            sx={{
              bgcolor: 'rgba(33,150,243,0.06)',
              border: '1px solid rgba(33,150,243,0.2)',
              borderRadius: 3,
              cursor: 'pointer',
              '&:active': { transform: 'scale(0.98)' },
            }}
          >
            <CardContent sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, '&:last-child': { pb: 2 } }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: '10px',
                bgcolor: 'rgba(33,150,243,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <DirectionsCarIcon sx={{ color: '#2196f3', fontSize: 22 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                  주차중 {activeParking}대
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                  탭하여 위치 확인
                </Typography>
              </Box>
              <ArrowForwardIosIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }} />
            </CardContent>
          </Card>
        </Box>
      )}

      {/* My Complexes */}
      <Box sx={{ px: 2, mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2 }}>
          <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
            소속 단지
          </Typography>
          <Button size="small" onClick={() => navigate('/app/profile')} sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', minWidth: 0 }}>
            관리
          </Button>
        </Box>
        {memberships.length === 0 ? (
          <Card
            onClick={() => navigate('/app/profile')}
            sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 3, cursor: 'pointer' }}
          >
            <CardContent sx={{ p: 2, textAlign: 'center', '&:last-child': { pb: 2 } }}>
              <ApartmentIcon sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 28, mb: 0.5 }} />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>
                단지 등록 신청하기
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
            {memberships.map(m => (
              <Card key={m.id} sx={{
                bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 2.5, minWidth: 160, flexShrink: 0,
              }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.5 }}>
                    <ApartmentIcon sx={{ color: '#2196f3', fontSize: 16 }} />
                    <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.72rem' }}>
                      {m.complex?.name || '단지'}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem' }}>
                    {m.building_dong && `${m.building_dong}동 `}{m.unit_number}호
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Box>

      {/* Recent Activity */}
      <Box sx={{ px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1.2 }}>
          <HistoryIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }} />
          <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>최근 이용</Typography>
        </Box>
        {recentPayments.length === 0 ? (
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>이용내역이 없습니다</Typography>
        ) : (
          recentPayments.slice(0, 3).map(p => (
            <Box key={p.id} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              py: 1.2, borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <Box sx={{
                width: 32, height: 32, borderRadius: '8px',
                bgcolor: p.status === 'pending' ? 'rgba(255,152,0,0.1)' : 'rgba(0,212,170,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <DirectionsCarIcon sx={{ fontSize: 16, color: p.status === 'pending' ? '#ff9800' : '#00d4aa' }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500, fontSize: '0.82rem' }}>{p.vehicle_plate}</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.65rem' }}>
                  {new Date(p.entry_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  {p.duration_minutes > 0 && ` | ${p.duration_minutes}분`}
                </Typography>
              </Box>
              {p.amount_coins > 0 && (
                <Chip
                  label={`-${p.amount_coins.toLocaleString()}`}
                  size="small"
                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(255,112,67,0.1)', color: '#ff7043' }}
                />
              )}
              {p.status === 'pending' && (
                <Chip label="주차중" size="small" sx={{ height: 20, fontSize: '0.6rem', bgcolor: 'rgba(255,152,0,0.1)', color: '#ff9800' }} />
              )}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}

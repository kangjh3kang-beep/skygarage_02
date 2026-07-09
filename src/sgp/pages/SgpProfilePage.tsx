import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import ApartmentIcon from '@mui/icons-material/Apartment';
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';
import NfcIcon from '@mui/icons-material/Nfc';
import PersonIcon from '@mui/icons-material/Person';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useNavigate } from 'react-router-dom';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { supabase } from '../../lib/supabase';
import type { SgpComplexMembership } from '../types';

interface Complex {
  id: string;
  name: string;
  address: string;
}

export default function SgpProfilePage() {
  const { user, signOut } = useSgpAuth();
  const navigate = useNavigate();
  const [memberships, setMemberships] = useState<SgpComplexMembership[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedComplex, setSelectedComplex] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [buildingDong, setBuildingDong] = useState('');
  const [role, setRole] = useState('resident');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadMemberships();
  }, [user]);

  const loadMemberships = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('sgp_complex_memberships')
      .select('*, complex:complexes(id, name, address)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setMemberships(data || []);
  };

  const loadComplexes = async () => {
    const { data } = await supabase.from('complexes').select('id, name, address').order('name');
    setComplexes(data || []);
  };

  const openRegisterDialog = () => {
    loadComplexes();
    setSelectedComplex('');
    setUnitNumber('');
    setBuildingDong('');
    setRole('resident');
    setRegisterOpen(true);
  };

  const handleSubmitRegistration = async () => {
    if (!user || !selectedComplex || !unitNumber.trim()) return;
    setSubmitting(true);

    const { error } = await supabase.from('sgp_complex_memberships').insert({
      user_id: user.id,
      complex_id: selectedComplex,
      unit_number: unitNumber.trim(),
      building_dong: buildingDong.trim(),
      role,
      request_status: 'pending',
      requested_by: 'user',
    });

    if (!error) {
      await loadMemberships();
      setRegisterOpen(false);
    }
    setSubmitting(false);
  };

  const handleCancelRequest = async (id: string) => {
    await supabase.from('sgp_complex_memberships').delete().eq('id', id);
    await loadMemberships();
  };

  const generateNfcToken = async () => {
    if (!user) return;
    const token = `SGP-${user.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    await supabase.from('sgp_users').update({ nfc_token: token }).eq('id', user.id);
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Profile Header */}
      <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ width: 56, height: 56, bgcolor: 'rgba(0,212,170,0.15)' }}>
            <PersonIcon sx={{ color: '#00d4aa' }} />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>{user?.display_name}</Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>{user?.phone}</Typography>
            {user?.nfc_token && (
              <Chip
                icon={<NfcIcon sx={{ fontSize: 14, color: '#00d4aa !important' }} />}
                label={user.nfc_token}
                size="small"
                sx={{ mt: 0.5, bgcolor: 'rgba(0,212,170,0.1)', color: '#00d4aa', fontSize: '0.65rem', height: 20 }}
              />
            )}
          </Box>
        </CardContent>
      </Card>

      {/* NFC Token */}
      {!user?.nfc_token && (
        <Card sx={{ bgcolor: 'rgba(255,152,0,0.05)', border: '1px solid rgba(255,152,0,0.2)', borderRadius: 2, mb: 3 }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="body2" sx={{ color: '#ff9800', fontWeight: 600, mb: 1 }}>NFC 결제 토큰 미설정</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 1.5 }}>
              결제 단말기 태그를 위해 NFC 토큰을 발급받으세요.
            </Typography>
            <Button
              size="small"
              variant="contained"
              startIcon={<NfcIcon />}
              onClick={generateNfcToken}
              sx={{ bgcolor: '#ff9800', color: '#fff', '&:hover': { bgcolor: '#f57c00' } }}
            >
              토큰 발급
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Memberships */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700 }}>소속 단지/건물</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={openRegisterDialog} sx={{ color: '#00d4aa', fontSize: '0.75rem' }}>
          등록 신청
        </Button>
      </Box>

      {memberships.length === 0 ? (
        <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
          <CardContent sx={{ p: 3, textAlign: 'center' }}>
            <ApartmentIcon sx={{ fontSize: 40, color: 'rgba(255,255,255,0.2)', mb: 1 }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>등록된 단지가 없습니다</Typography>
          </CardContent>
        </Card>
      ) : (
        memberships.map(m => (
          <Card key={m.id} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, mb: 1.5 }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ApartmentIcon sx={{ color: '#2196f3', fontSize: 20 }} />
                  <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                    {m.complex?.name || '단지'}
                  </Typography>
                </Box>
                <Chip
                  label={m.request_status === 'approved' ? '승인됨' : m.request_status === 'pending' ? '대기중' : '거절됨'}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    bgcolor: m.request_status === 'approved' ? 'rgba(76,175,80,0.1)' : m.request_status === 'pending' ? 'rgba(255,152,0,0.1)' : 'rgba(244,67,54,0.1)',
                    color: m.request_status === 'approved' ? '#4caf50' : m.request_status === 'pending' ? '#ff9800' : '#f44336',
                  }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                {m.building_dong && `${m.building_dong}동 `}{m.unit_number}호 | {m.role === 'owner' ? '소유자' : m.role === 'tenant' ? '세입자' : '입주민'}
              </Typography>
              {m.request_status === 'pending' && (
                <Box sx={{ mt: 1 }}>
                  <Button size="small" color="error" onClick={() => handleCancelRequest(m.id)} sx={{ fontSize: '0.7rem' }}>
                    신청 취소
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        ))
      )}

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 3 }} />

      {/* Quick Links */}
      <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: 0 }}>
          {[
            { label: '내 차량', icon: <DirectionsCarIcon sx={{ fontSize: 20, color: '#0ea5e9' }} />, path: '/app/vehicles' },
            { label: '알림', icon: <NotificationsIcon sx={{ fontSize: 20, color: '#3b82f6' }} />, path: '/app/notifications' },
            { label: '방문자 초대', icon: <PersonAddIcon sx={{ fontSize: 20, color: '#f59e0b' }} />, path: '/app/visitor/invite' },
            { label: '개인정보 설정', icon: <PrivacyTipIcon sx={{ fontSize: 20, color: '#00d4aa' }} />, path: '/app/privacy' },
          ].map((item, idx) => (
            <Box key={item.path}>
              {idx > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />}
              <Box
                onClick={() => navigate(item.path)}
                sx={{
                  px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5,
                  cursor: 'pointer', '&:active': { bgcolor: 'rgba(255,255,255,0.05)' },
                }}
              >
                {item.icon}
                <Typography variant="body2" sx={{ flex: 1, color: '#fff', fontWeight: 500 }}>{item.label}</Typography>
                <ChevronRightIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} />
              </Box>
            </Box>
          ))}
        </CardContent>
      </Card>

      <Button
        variant="outlined"
        startIcon={<LogoutIcon />}
        fullWidth
        onClick={signOut}
        sx={{ color: '#f44336', borderColor: 'rgba(244,67,54,0.3)', '&:hover': { borderColor: '#f44336', bgcolor: 'rgba(244,67,54,0.05)' } }}
      >
        로그아웃
      </Button>

      {/* Register Dialog */}
      <Dialog open={registerOpen} onClose={() => setRegisterOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { bgcolor: '#1a2d42', color: '#fff' } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>단지/건물 등록 신청</DialogTitle>
        <DialogContent>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 2 }}>
            관리자 승인 후 이용 가능합니다.
          </Typography>
          <TextField
            select
            label="단지 선택"
            value={selectedComplex}
            onChange={e => setSelectedComplex(e.target.value)}
            fullWidth
            size="small"
            sx={{ mb: 2, '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)' } }}
            slotProps={{ inputLabel: { sx: { color: 'rgba(255,255,255,0.7)' } } }}
          >
            {complexes.map(c => (
              <MenuItem key={c.id} value={c.id}>{c.name} - {c.address}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="동"
            value={buildingDong}
            onChange={e => setBuildingDong(e.target.value)}
            fullWidth
            size="small"
            placeholder="예: 101"
            sx={{ mb: 2, '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)' }, '& input': { color: '#fff' } }}
            slotProps={{ inputLabel: { sx: { color: 'rgba(255,255,255,0.7)' } } }}
          />
          <TextField
            label="호수"
            value={unitNumber}
            onChange={e => setUnitNumber(e.target.value)}
            fullWidth
            size="small"
            placeholder="예: 1204"
            sx={{ mb: 2, '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)' }, '& input': { color: '#fff' } }}
            slotProps={{ inputLabel: { sx: { color: 'rgba(255,255,255,0.7)' } } }}
          />
          <TextField
            select
            label="유형"
            value={role}
            onChange={e => setRole(e.target.value)}
            fullWidth
            size="small"
            sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)' } }}
            slotProps={{ inputLabel: { sx: { color: 'rgba(255,255,255,0.7)' } } }}
          >
            <MenuItem value="resident">입주민</MenuItem>
            <MenuItem value="owner">소유자</MenuItem>
            <MenuItem value="tenant">세입자</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setRegisterOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)' }}>취소</Button>
          <Button
            variant="contained"
            onClick={handleSubmitRegistration}
            disabled={submitting || !selectedComplex || !unitNumber.trim()}
            sx={{ bgcolor: '#00d4aa', color: '#0d1b2a', fontWeight: 700, '&:hover': { bgcolor: '#00b894' } }}
          >
            {submitting ? '처리중...' : '신청하기'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

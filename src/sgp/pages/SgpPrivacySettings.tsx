import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { getConsents, grantConsent, revokeConsent, isConsentGranted, CONSENT_DESCRIPTIONS } from '../services/consentService';
import type { ConsentRecord, ConsentCategory } from '../types';

export default function SgpPrivacySettings() {
  const { user } = useSgpAuth();
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    loadConsents();
  }, [user]);

  async function loadConsents() {
    if (!user) return;
    setError('');
    try {
      const data = await getConsents(user.id);
      setConsents(data);
    } catch {
      setError('개인정보 설정을 불러올 수 없습니다.');
    }
    setLoading(false);
  }

  async function handleToggle(category: ConsentCategory, currentlyGranted: boolean) {
    if (!user) return;
    try {
      if (currentlyGranted) {
        await revokeConsent(user.id, category);
      } else {
        await grantConsent(user.id, category);
      }
      await loadConsents();
    } catch {
      setError('설정 변경에 실패했습니다.');
    }
  }

  const categories: ConsentCategory[] = ['location', 'vehicle_pii', 'marketing', 'third_party', 'analytics'];

  return (
    <Box sx={{ px: 2, pt: 3, pb: 10 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <PrivacyTipIcon sx={{ color: '#00d4aa' }} />
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>개인정보 설정</Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3, borderRadius: 2, '& .MuiAlert-message': { fontSize: '0.78rem' } }}>
        각 항목은 개별적으로 동의/철회할 수 있습니다. 필수 항목을 철회하면 관련 기능이 비활성화됩니다.
      </Alert>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
        <CardContent sx={{ p: 0 }}>
          {categories.map((category, idx) => {
            const desc = CONSENT_DESCRIPTIONS[category];
            const granted = isConsentGranted(consents, category);

            return (
              <Box key={category}>
                {idx > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />}
                <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>
                        {desc.title}
                      </Typography>
                      {desc.required && (
                        <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 600 }}>필수</Typography>
                      )}
                    </Box>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.3 }}>
                      {desc.description}
                    </Typography>
                  </Box>
                  <Switch
                    checked={granted}
                    onChange={() => handleToggle(category, granted)}
                    disabled={loading}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: '#00d4aa' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#00d4aa' },
                    }}
                  />
                </Box>
              </Box>
            );
          })}
        </CardContent>
      </Card>

      <Box sx={{ mt: 3 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
          개인정보 처리방침에 따라 수집된 정보는 목적 달성 후 즉시 파기됩니다. 단, 전자상거래법에 따른 거래기록은 5년간 보존됩니다.
        </Typography>
      </Box>

      <Button
        fullWidth
        variant="outlined"
        sx={{ mt: 3, color: '#ff5252', borderColor: 'rgba(255,82,82,0.3)', borderRadius: 2, textTransform: 'none' }}
      >
        계정 탈퇴 및 데이터 삭제 요청
      </Button>
    </Box>
  );
}

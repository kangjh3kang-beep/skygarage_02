import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Switch from '@mui/material/Switch';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import SecurityIcon from '@mui/icons-material/Security';
import { useSgpAuth } from '../contexts/SgpAuthContext';
import { listConsents, grantConsent, revokeConsent } from '../services/consentService';
import type { ConsentRecord, ConsentCategory } from '../types';

const CONSENT_LABELS: Record<ConsentCategory, { title: string; desc: string }> = {
  location: { title: '위치 정보', desc: '차량 위치 추적 및 주차장 안내에 사용됩니다' },
  vehicle_pii: { title: '차량 개인정보', desc: '차량번호, 모델 등 차량 식별 정보 수집' },
  marketing: { title: '마케팅 수신', desc: '이벤트, 프로모션 등 마케팅 알림 수신' },
  third_party: { title: '제3자 제공', desc: '제휴사에 정보를 제공하여 서비스를 개선합니다' },
  analytics: { title: '분석 데이터', desc: '서비스 개선을 위한 이용 패턴 분석' },
};

const CATEGORIES: ConsentCategory[] = ['location', 'vehicle_pii', 'marketing', 'third_party', 'analytics'];

export default function SgpPrivacySettings() {
  const { user } = useSgpAuth();
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const data = await listConsents(user!.id);
      setConsents(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(category: ConsentCategory, currentlyGranted: boolean) {
    if (!user) return;
    setToggling(category);
    try {
      if (currentlyGranted) {
        await revokeConsent(user.id, category);
      } else {
        await grantConsent(user.id, category);
      }
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setToggling(null);
    }
  }

  function isGranted(category: ConsentCategory): boolean {
    const record = consents.find(c => c.category === category);
    return record?.granted ?? false;
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: '#00d4aa' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>{error}</Typography>
        <Button onClick={loadData} size="small" sx={{ color: '#00d4aa' }}>다시 시도</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <SecurityIcon sx={{ color: '#00d4aa' }} />
        <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>개인정보 설정</Typography>
      </Box>

      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mb: 2 }}>
        수집/이용 동의를 관리합니다. 필수 항목은 서비스 이용에 필요합니다.
      </Typography>

      {CATEGORIES.map(category => {
        const granted = isGranted(category);
        const info = CONSENT_LABELS[category];
        return (
          <Card key={category} sx={{ mb: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, mb: 0.3 }}>{info.title}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>{info.desc}</Typography>
                </Box>
                <Switch
                  checked={granted}
                  onChange={() => handleToggle(category, granted)}
                  disabled={toggling === category}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#00d4aa' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: 'rgba(0,212,170,0.4)' },
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        );
      })}

      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block', mt: 3, textAlign: 'center' }}>
        개인정보 처리방침에 따라 데이터가 관리됩니다
      </Typography>
    </Box>
  );
}

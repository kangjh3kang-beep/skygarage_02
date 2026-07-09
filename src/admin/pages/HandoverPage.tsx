import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import NightsStayIcon from '@mui/icons-material/NightsStay';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

interface HandoverChecklist {
  id: string;
  label: string;
  required: boolean;
  checked: boolean;
}

export default function HandoverPage() {
  useDocumentTitle('교대 인계');
  const [mode, setMode] = useState<'attended' | 'unattended'>('attended');
  const [checklist, setChecklist] = useState<HandoverChecklist[]>([
    { id: 'safety', label: '안전 상태 정상 (비상정지 미활성)', required: true, checked: false },
    { id: 'incidents', label: '미결 인시던트 0건', required: true, checked: false },
    { id: 'missions', label: '진행중 미션 상태 확인', required: true, checked: false },
    { id: 'devices', label: '장비 이상 없음 (격리 장비 현황 확인)', required: true, checked: false },
    { id: 'alerts', label: '미확인 경보 0건', required: true, checked: false },
    { id: 'elevator', label: '엘리베이터 가동 상태 정상', required: true, checked: false },
    { id: 'notes', label: '인수인계 사항 기록 완료', required: false, checked: false },
    { id: 'contact', label: '비상 연락처 확인', required: false, checked: false },
  ]);

  const allRequiredChecked = checklist.filter(c => c.required).every(c => c.checked);

  const toggleCheck = (id: string) => {
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c));
  };

  const handleModeSwitch = () => {
    if (!allRequiredChecked) return;
    setMode(mode === 'attended' ? 'unattended' : 'attended');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>교대 / 야간 무인 인계</Typography>
          <Typography variant="body2" color="text.secondary">
            24h 무인 전환 게이트 및 인계 체크리스트
          </Typography>
        </Box>
        <Chip
          icon={mode === 'unattended' ? <NightsStayIcon /> : <SwapHorizIcon />}
          label={mode === 'unattended' ? '무인 운영 중' : '유인 운영 중'}
          color={mode === 'unattended' ? 'warning' : 'success'}
          sx={{ fontWeight: 600 }}
        />
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>현재 상태</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">운영 모드</Typography>
                  <Chip label={mode === 'attended' ? '유인' : '무인'} size="small" color={mode === 'attended' ? 'success' : 'warning'} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">미결 인시던트</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>0건</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">활성 미션</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>3건</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">격리 장비</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>0대</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">안전 상태</Typography>
                  <Chip label="정상" size="small" color="success" />
                </Box>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary">
                무인 전환 시 P0 인시던트 발생 시 자동 에스컬레이션 (관제+현장 기술자 호출)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              {mode === 'attended' ? '무인 전환 체크리스트' : '유인 복귀 체크리스트'}
            </Typography>

            {checklist.map((item) => (
              <Box key={item.id} sx={{ mb: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={item.checked}
                      onChange={() => toggleCheck(item.id)}
                      color={item.required ? 'primary' : 'default'}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">{item.label}</Typography>
                      {item.required && <Chip label="필수" size="small" sx={{ height: 18, fontSize: '0.65rem' }} color="primary" variant="outlined" />}
                    </Box>
                  }
                />
              </Box>
            ))}

            <Divider sx={{ my: 2 }} />

            {!allRequiredChecked && (
              <Alert severity="info" sx={{ mb: 2 }}>
                모든 필수 항목을 확인해야 운영 모드를 전환할 수 있습니다.
              </Alert>
            )}

            <Button
              variant="contained"
              color={mode === 'attended' ? 'warning' : 'success'}
              disabled={!allRequiredChecked}
              onClick={handleModeSwitch}
              startIcon={mode === 'attended' ? <NightsStayIcon /> : <CheckCircleIcon />}
              fullWidth
              size="large"
            >
              {mode === 'attended' ? '무인 모드 전환 (UnattendedModeEntered)' : '유인 모드 복귀'}
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {mode === 'unattended' && (
        <Alert severity="warning" sx={{ mt: 3 }} icon={<WarningIcon />}>
          무인 운영 중입니다. P0 인시던트 발생 시 관제 운영자 및 현장 기술자에게 자동 에스컬레이션됩니다.
          안전 체인은 네트워크 독립으로 물리적 보호를 유지합니다.
        </Alert>
      )}
    </Box>
  );
}

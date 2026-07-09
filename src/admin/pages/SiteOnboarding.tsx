import { useState } from 'react';
import {
  Box, Paper, Typography, Stepper, Step, StepLabel, StepContent,
  Button, TextField, Grid, Alert, Chip, Card, CardContent,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { supabase } from '../../lib/supabase';

interface OnboardingData {
  name: string;
  code: string;
  address: string;
  region: string;
  elevatorCount: number;
  atrCount: number;
  bayCount: number;
  contactName: string;
  contactEmail: string;
}

const STEPS = ['기본 정보', '설비 구성', '담당자 등록', '검증 및 완료'];

export default function SiteOnboarding() {
  const [activeStep, setActiveStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    name: '', code: '', address: '', region: '',
    elevatorCount: 2, atrCount: 1, bayCount: 4,
    contactName: '', contactEmail: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');

  function updateField(field: keyof OnboardingData, value: string | number) {
    setData(prev => ({ ...prev, [field]: value }));
  }

  function canAdvance(): boolean {
    switch (activeStep) {
      case 0: return !!data.name && !!data.code && !!data.address;
      case 1: return data.elevatorCount > 0 && data.atrCount > 0 && data.bayCount > 0;
      case 2: return !!data.contactName && !!data.contactEmail;
      default: return true;
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');

    const { error: insertErr } = await supabase.from('complexes').insert({
      name: data.name,
      code: data.code,
      address: data.address,
      status: 'poc',
    });

    if (insertErr) {
      setError(insertErr.message);
      setSubmitting(false);
      return;
    }

    await supabase.from('domain_events').insert({
      site_id: data.code,
      envelope: 'AuditEvent',
      subtype: 'ops',
      action: 'SiteOnboarded',
      payload: data,
      idempotency_key: `onboard-${data.code}-${Date.now()}`,
      created_at: new Date().toISOString(),
    });

    // Initialize safety chain state for the new site
    await supabase.from('safety_chain_states').insert({
      site_id: data.code,
      sto_active: false,
      safety_relay_engaged: true,
      drive_enabled: false,
      emergency_stop_active: false,
    });

    setSubmitting(false);
    setCompleted(true);
  }

  if (completed) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>사이트 온보딩 완료</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {data.name} ({data.code}) 사이트가 성공적으로 등록되었습니다.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Chip label={`엘리베이터 ${data.elevatorCount}대`} color="primary" />
            <Chip label={`ATR ${data.atrCount}대`} color="secondary" />
            <Chip label={`베이 ${data.bayCount}개`} />
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>신규 사이트 온보딩</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 3 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          <Step>
            <StepLabel>{STEPS[0]}</StepLabel>
            <StepContent>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth label="단지명" value={data.name} onChange={e => updateField('name', e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth label="단지 코드" value={data.code} onChange={e => updateField('code', e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField fullWidth label="주소" value={data.address} onChange={e => updateField('address', e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth label="지역" value={data.region} onChange={e => updateField('region', e.target.value)} />
                </Grid>
              </Grid>
              <Box sx={{ mt: 2 }}>
                <Button variant="contained" onClick={() => setActiveStep(1)} disabled={!canAdvance()}>다음</Button>
              </Box>
            </StepContent>
          </Step>

          <Step>
            <StepLabel>{STEPS[1]}</StepLabel>
            <StepContent>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth type="number" label="엘리베이터 수" value={data.elevatorCount} onChange={e => updateField('elevatorCount', parseInt(e.target.value) || 0)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth type="number" label="ATR 수" value={data.atrCount} onChange={e => updateField('atrCount', parseInt(e.target.value) || 0)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField fullWidth type="number" label="베이 수" value={data.bayCount} onChange={e => updateField('bayCount', parseInt(e.target.value) || 0)} />
                </Grid>
              </Grid>
              <Card variant="outlined" sx={{ mt: 2, bgcolor: 'action.hover' }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">예상 처리량</Typography>
                  <Typography>시간당 최대 {data.elevatorCount * data.atrCount * 4}회 이송</Typography>
                </CardContent>
              </Card>
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button onClick={() => setActiveStep(0)}>이전</Button>
                <Button variant="contained" onClick={() => setActiveStep(2)} disabled={!canAdvance()}>다음</Button>
              </Box>
            </StepContent>
          </Step>

          <Step>
            <StepLabel>{STEPS[2]}</StepLabel>
            <StepContent>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth label="담당자 이름" value={data.contactName} onChange={e => updateField('contactName', e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth label="담당자 이메일" type="email" value={data.contactEmail} onChange={e => updateField('contactEmail', e.target.value)} />
                </Grid>
              </Grid>
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button onClick={() => setActiveStep(1)}>이전</Button>
                <Button variant="contained" onClick={() => setActiveStep(3)} disabled={!canAdvance()}>다음</Button>
              </Box>
            </StepContent>
          </Step>

          <Step>
            <StepLabel>{STEPS[3]}</StepLabel>
            <StepContent>
              <Alert severity="info" sx={{ mb: 2 }}>
                등록 전 최종 확인해주세요. 온보딩 후 안전 체인이 자동 초기화됩니다.
              </Alert>
              <Grid container spacing={1}>
                <Grid size={{ xs: 6 }}><Typography variant="body2" color="text.secondary">단지명:</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="body2">{data.name}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="body2" color="text.secondary">코드:</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="body2">{data.code}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="body2" color="text.secondary">설비:</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="body2">EV {data.elevatorCount} / ATR {data.atrCount} / Bay {data.bayCount}</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="body2" color="text.secondary">담당자:</Typography></Grid>
                <Grid size={{ xs: 6 }}><Typography variant="body2">{data.contactName}</Typography></Grid>
              </Grid>
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button onClick={() => setActiveStep(2)}>이전</Button>
                <Button variant="contained" color="success" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? '등록 중...' : '사이트 등록'}
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </Paper>
    </Box>
  );
}

import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { supabase } from '../../../lib/supabase';
import { evaluateDirectEntry, processVisitorEntry } from '../../services/directEntryService';
import type { DirectEntryDecision, VisitorRegistration } from '../../types';

export default function VisitorEntry() {
  const [step, setStep] = useState(0);
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registration, setRegistration] = useState<VisitorRegistration | null>(null);
  const [decision, setDecision] = useState<DirectEntryDecision | null>(null);
  const [completed, setCompleted] = useState(false);

  const handleLookup = async () => {
    if (!plate.trim()) return;
    setLoading(true);
    setError('');

    const { data } = await supabase
      .from('visitor_registrations')
      .select('*')
      .eq('plate_number', plate.trim())
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      setError('사전 등록된 차량 정보가 없습니다. 입주민에게 사전 등록을 요청하세요.');
      setLoading(false);
      return;
    }

    setRegistration(data);

    const entryDecision = await evaluateDirectEntry(data.household_id, plate.trim());
    setDecision(entryDecision);
    setStep(1);
    setLoading(false);
  };

  const handleConfirmEntry = async () => {
    if (!registration || !decision) return;
    setLoading(true);
    await processVisitorEntry(
      registration.household_id,
      registration.id,
      plate.trim(),
      decision
    );
    setStep(2);
    setCompleted(true);
    setLoading(false);
  };

  const steps = ['차량 확인', '입차 방법 결정', '입차 완료'];

  return (
    <Box sx={{ p: 2, maxWidth: 500, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, textAlign: 'center', mb: 1 }}>
        방문 차량 입차
      </Typography>
      <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary', mb: 3 }}>
        사전 등록된 차량 번호를 입력하세요
      </Typography>

      <Stepper activeStep={step} sx={{ mb: 3 }}>
        {steps.map(label => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>

      {/* Step 0: Plate Lookup */}
      {step === 0 && (
        <Card>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="차량 번호"
              placeholder="12가 3456"
              value={plate}
              onChange={e => setPlate(e.target.value)}
              fullWidth
              autoFocus
              slotProps={{ input: { startAdornment: <DirectionsCarIcon sx={{ color: 'text.secondary', mr: 1 }} /> } }}
            />
            {error && <Alert severity="warning">{error}</Alert>}
            <Button
              variant="contained"
              fullWidth
              onClick={handleLookup}
              disabled={!plate.trim() || loading}
              sx={{ py: 1.5 }}
            >
              {loading ? <CircularProgress size={24} /> : '차량 확인'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Entry Decision */}
      {step === 1 && decision && registration && (
        <Card>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ textAlign: 'center', py: 1 }}>
              <SmartToyIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{plate}</Typography>
              <Chip
                label={decision.entry_type === 'direct_entry' ? '세대직입' : decision.entry_type === 'valet' ? '발렛 주차' : '일반 주차'}
                color={decision.allowed ? 'success' : 'warning'}
                sx={{ mb: 1 }}
              />
            </Box>

            <Alert severity={decision.allowed ? 'success' : 'info'}>
              {decision.reason}
            </Alert>

            <Box sx={{ bgcolor: 'background.default', borderRadius: 2, p: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>방문 정보</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                방문자: {registration.visitor_name || '-'}
              </Typography>
              <Typography variant="body2">
                무료 주차: {registration.free_hours_granted}시간
              </Typography>
            </Box>

            <Button
              variant="contained"
              fullWidth
              onClick={handleConfirmEntry}
              disabled={loading}
              sx={{ py: 1.5 }}
            >
              {loading ? <CircularProgress size={24} /> : '입차 진행'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Completed */}
      {step === 2 && completed && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>입차 완료</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              {decision?.entry_type === 'direct_entry'
                ? 'ATR이 차량을 세대 지정면으로 이송합니다.'
                : decision?.entry_type === 'valet'
                  ? 'ATR이 차량을 자율주차 전용면으로 이송합니다.'
                  : '방문 주차장에 주차하세요.'}
            </Typography>
            <Chip label={`무료 주차: ${registration?.free_hours_granted}시간`} color="info" />
            <Button
              variant="outlined"
              fullWidth
              onClick={() => { setStep(0); setPlate(''); setRegistration(null); setDecision(null); setCompleted(false); }}
              sx={{ mt: 3 }}
            >
              새 차량 입차
            </Button>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

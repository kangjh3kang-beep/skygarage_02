import { useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Alert, CircularProgress, Typography, Box,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { performStepUp, isStepUpValid, type StepUpReason } from '../services/stepUpAuth';
import { useAuth } from '../contexts/AuthContext';

const REASON_LABELS: Record<StepUpReason, string> = {
  emergency_release: '비상 해제',
  rbac_change: '권한 변경',
  settlement_payment: '정산 결제',
  policy_publish: '정책 배포',
  data_export: '데이터 내보내기',
};

interface StepUpDialogProps {
  open: boolean;
  reason: StepUpReason;
  onSuccess: () => void;
  onCancel: () => void;
}

export function StepUpDialog({ open, reason, onSuccess, onCancel }: StepUpDialogProps) {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!user?.email || !password) return;
    setLoading(true);
    setError('');

    const result = await performStepUp(user.email, password, reason);
    setLoading(false);

    if (result.success) {
      setPassword('');
      onSuccess();
    } else {
      setError(result.error ?? '인증에 실패했습니다.');
    }
  }, [user, password, reason, onSuccess]);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LockIcon color="warning" />
        추가 인증 필요
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>{REASON_LABELS[reason]}</strong> 작업을 수행하려면 비밀번호를 다시 입력하세요.
          </Typography>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          autoFocus
          fullWidth
          type="password"
          label="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          disabled={loading}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>취소</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !password}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          인증
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function useStepUp() {
  const { user } = useAuth();

  const checkStepUp = useCallback((reason: StepUpReason): boolean => {
    if (!user) return false;
    return isStepUpValid(user.id, reason);
  }, [user]);

  return { checkStepUp };
}

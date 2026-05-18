import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { ETAInfo } from '../../types';
import { formatDistance } from '../../utils/geo';

interface ETAPanelProps {
  eta: ETAInfo;
  originName?: string;
  destinationName?: string;
  vehicleStatus?: string;
}

function formatCountdown(totalSec: number): string {
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function ETAPanel({ eta, originName, destinationName, vehicleStatus }: ETAPanelProps) {
  const [countdownSec, setCountdownSec] = useState(0);

  useEffect(() => {
    if (!eta.estimatedArrival) return;
    const update = () => {
      const diff = Math.max(0, eta.estimatedArrival!.getTime() - Date.now());
      setCountdownSec(Math.floor(diff / 1000));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [eta.estimatedArrival]);

  if (!eta.estimatedArrival) {
    const message = vehicleStatus === 'available'
      ? '차량이 대기중입니다. 경로가 활성화되면 도착 시간이 표시됩니다.'
      : vehicleStatus === 'offline'
        ? '차량이 오프라인 상태입니다.'
        : '경로 정보가 없습니다.';
    return (
      <Paper sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">{message}</Typography>
      </Paper>
    );
  }

  const progressClamped = Math.min(Math.max(eta.progressPercent, 0), 100);

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTimeIcon sx={{ color: eta.isDelayed ? 'warning.main' : 'primary.main' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>도착 예상 시간</Typography>
        </Box>
        {eta.isDelayed && (
          <Chip icon={<WarningAmberIcon />} label="지연" size="small" color="warning" />
        )}
      </Box>

      {/* Countdown timer */}
      <Box sx={{ textAlign: 'center', my: 2 }}>
        <Typography
          sx={{
            fontSize: '2.5rem',
            fontWeight: 800,
            fontFamily: 'monospace',
            color: eta.isDelayed ? 'warning.main' : 'primary.main',
            lineHeight: 1,
          }}
        >
          {formatCountdown(countdownSec)}
        </Typography>
        <Typography variant="caption" color="text.secondary">남은 시간</Typography>
      </Box>

      {/* Progress bar */}
      <Box sx={{ mb: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>{originName || '출발'}</Typography>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>{destinationName || '도착'}</Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progressClamped}
          sx={{ height: 8, borderRadius: 4, bgcolor: 'action.hover' }}
          color={eta.isDelayed ? 'warning' : 'primary'}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">{progressClamped.toFixed(0)}% 완료</Typography>
          <Typography variant="caption" color="text.secondary">{formatDistance(eta.distanceKm)} 남음</Typography>
        </Box>
      </Box>

      {/* Arrival time */}
      <Box sx={{ textAlign: 'center', p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
        <Typography variant="caption" color="text.secondary">예상 도착</Typography>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {eta.estimatedArrival.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </Typography>
      </Box>
    </Paper>
  );
}

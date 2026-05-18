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
}

export default function ETAPanel({ eta, originName, destinationName }: ETAPanelProps) {
  const [countdown, setCountdown] = useState({ min: 0, sec: 0 });

  useEffect(() => {
    if (!eta.estimatedArrival) return;
    const update = () => {
      const diff = Math.max(0, eta.estimatedArrival!.getTime() - Date.now());
      const totalSec = Math.floor(diff / 1000);
      setCountdown({ min: Math.floor(totalSec / 60), sec: totalSec % 60 });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [eta.estimatedArrival]);

  if (!eta.estimatedArrival) {
    return (
      <Paper sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">경로 정보가 없습니다</Typography>
      </Paper>
    );
  }

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
          {String(countdown.min).padStart(2, '0')}:{String(countdown.sec).padStart(2, '0')}
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
          value={eta.progressPercent}
          sx={{ height: 8, borderRadius: 4, bgcolor: 'action.hover' }}
          color={eta.isDelayed ? 'warning' : 'primary'}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">{eta.progressPercent.toFixed(0)}% 완료</Typography>
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

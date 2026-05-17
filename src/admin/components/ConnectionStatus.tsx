import { useState, useEffect } from 'react';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import WifiOffIcon from '@mui/icons-material/WifiOff';

export default function ConnectionStatus() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <Tooltip title="인터넷 연결이 끊어졌습니다. 연결을 확인해 주세요.">
      <Chip
        icon={<WifiOffIcon sx={{ fontSize: 14 }} />}
        label="오프라인"
        size="small"
        color="error"
        variant="outlined"
        sx={{ height: 24, fontSize: '0.6875rem' }}
      />
    </Tooltip>
  );
}

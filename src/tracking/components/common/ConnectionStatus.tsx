import { useState, useEffect } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import WifiIcon from '@mui/icons-material/Wifi';

export default function ConnectionStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => { setOnline(true); setShowReconnected(true); };
    const handleOffline = () => { setOnline(false); setShowReconnected(false); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      <Snackbar open={!online} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="warning" icon={<WifiOffIcon />} sx={{ width: '100%' }}>
          인터넷 연결이 끊어졌습니다. 실시간 업데이트가 중단됩니다.
        </Alert>
      </Snackbar>
      <Snackbar
        open={showReconnected}
        autoHideDuration={3000}
        onClose={() => setShowReconnected(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" icon={<WifiIcon />} sx={{ width: '100%' }}>
          연결이 복구되었습니다.
        </Alert>
      </Snackbar>
    </>
  );
}

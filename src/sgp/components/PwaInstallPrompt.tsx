import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import GetAppIcon from '@mui/icons-material/GetApp';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import IosShareIcon from '@mui/icons-material/IosShare';
import MoreVertIcon from '@mui/icons-material/MoreVert';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    if (isStandalone) return;

    const ua = navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIos(ios);

    const dismissed = sessionStorage.getItem('sgp-install-dismissed');
    if (dismissed) return;

    if (ios) {
      setTimeout(() => setShowBanner(true), 2000);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 1500);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
        setDeferredPrompt(null);
      }
    } else if (isIos) {
      setShowGuide(true);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('sgp-install-dismissed', '1');
  };

  if (isInstalled || !showBanner) return null;

  return (
    <>
      {/* Install Banner */}
      <Box sx={{
        position: 'fixed', bottom: 72, left: 12, right: 12, zIndex: 1200,
        bgcolor: 'rgba(13,27,42,0.95)', borderRadius: 3,
        border: '1px solid rgba(0,212,170,0.3)',
        p: 2, display: 'flex', alignItems: 'center', gap: 1.5,
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'slideUp 0.4s ease',
        '@keyframes slideUp': { from: { transform: 'translateY(100%)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
      }}>
        <Box sx={{
          width: 40, height: 40, borderRadius: '12px',
          bgcolor: 'rgba(0,212,170,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <PhoneIphoneIcon sx={{ color: '#00d4aa', fontSize: 22 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>
            SGP App 설치
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>
            홈 화면에 추가하여 앱처럼 사용하세요
          </Typography>
        </Box>
        <Button
          size="small" variant="contained" onClick={handleInstall}
          startIcon={<GetAppIcon sx={{ fontSize: 16 }} />}
          sx={{ bgcolor: '#00d4aa', color: '#0d1b2a', fontWeight: 700, fontSize: '0.75rem', borderRadius: 2, whiteSpace: 'nowrap', '&:hover': { bgcolor: '#00b894' } }}
        >
          설치
        </Button>
        <IconButton size="small" onClick={handleDismiss} sx={{ color: 'rgba(255,255,255,0.4)', p: 0.5 }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* iOS Install Guide */}
      <Dialog open={showGuide} onClose={() => setShowGuide(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { bgcolor: '#1a2d42', color: '#fff', borderRadius: 3 } } }}>
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Box sx={{ width: 56, height: 56, borderRadius: '14px', bgcolor: 'rgba(0,212,170,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
            <PhoneIphoneIcon sx={{ fontSize: 28, color: '#00d4aa' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>홈 화면에 추가</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 3 }}>
            아래 단계를 따라 SGP App을 설치하세요
          </Typography>

          <Box sx={{ textAlign: 'left', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
              <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'rgba(0,212,170,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="caption" sx={{ color: '#00d4aa', fontWeight: 700 }}>1</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="body2" sx={{ color: '#fff' }}>하단의</Typography>
                <IosShareIcon sx={{ fontSize: 18, color: '#2196f3' }} />
                <Typography variant="body2" sx={{ color: '#fff' }}>공유 버튼 탭</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
              <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'rgba(0,212,170,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="caption" sx={{ color: '#00d4aa', fontWeight: 700 }}>2</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#fff' }}>"홈 화면에 추가" 선택</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
              <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'rgba(0,212,170,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="caption" sx={{ color: '#00d4aa', fontWeight: 700 }}>3</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#fff' }}>"추가" 확인</Typography>
            </Box>
          </Box>

          {!isIos && (
            <Box sx={{ textAlign: 'left', mb: 2 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Android: 브라우저 메뉴 <MoreVertIcon sx={{ fontSize: 14 }} /> {'>'} &quot;앱 설치&quot; 또는 &quot;홈 화면에 추가&quot;
              </Typography>
            </Box>
          )}

          <Button fullWidth variant="contained" onClick={() => setShowGuide(false)} sx={{ bgcolor: '#00d4aa', color: '#0d1b2a', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: '#00b894' } }}>
            확인
          </Button>
        </Box>
      </Dialog>
    </>
  );
}

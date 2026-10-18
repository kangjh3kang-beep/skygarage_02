import { useEffect, useState } from 'react';
import { Alert, Button, Snackbar } from '@mui/material';

/** Notify long-lived tabs; never interrupt signup or a form with an automatic reload. */
export default function AppUpdateNotice() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const abort = new AbortController();
    let pending = false;
    async function check() {
      if (pending || document.visibilityState !== 'visible' || !navigator.onLine) return;
      pending = true;
      try {
        const response = await fetch(`/app-version.json?t=${Date.now()}`, { cache: 'no-store', signal: abort.signal });
        if (!response.ok) return;
        const version = await response.json();
        if (typeof version.release === 'string' && version.release !== import.meta.env.VITE_APP_RELEASE) setAvailable(true);
      } catch { /* A failed update check must not interrupt the app. */ }
      finally { pending = false; }
    }
    void check();
    const timer = window.setInterval(check, 300_000);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      abort.abort();
      window.clearInterval(timer);
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return (
    <Snackbar open={available} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
      <Alert severity="info" action={<Button color="inherit" href={`/app-update?returnTo=${encodeURIComponent(window.location.pathname)}`}>업데이트</Button>}>
        새 버전이 있습니다. 작성 중인 내용을 저장한 뒤 업데이트하세요.
      </Alert>
    </Snackbar>
  );
}

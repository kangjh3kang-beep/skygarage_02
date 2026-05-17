import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

type Severity = 'success' | 'error' | 'warning' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: string;
  message: string;
  severity: Severity;
  action?: ToastAction;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, severity?: Severity, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [, setToastQueue] = useState<ToastItem[]>([]);
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const [open, setOpen] = useState(false);

  const processQueue = useCallback(() => {
    setToastQueue(prev => {
      if (prev.length > 0) {
        const [next, ...rest] = prev;
        setCurrent(next);
        setOpen(true);
        return rest;
      }
      return prev;
    });
  }, []);

  const showToast = useCallback((message: string, severity: Severity = 'success', action?: ToastAction) => {
    const item: ToastItem = {
      id: crypto.randomUUID(),
      message,
      severity,
      action,
      duration: severity === 'error' ? 6000 : 4000,
    };

    if (!open) {
      setCurrent(item);
      setOpen(true);
    } else {
      setToastQueue(prev => [...prev, item]);
    }
  }, [open]);

  const handleClose = useCallback((_event?: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  }, []);

  const handleExited = useCallback(() => {
    setCurrent(null);
    processQueue();
  }, [processQueue]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={current?.duration ?? 4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ transition: { onExited: handleExited } }}
        sx={{ maxWidth: 480 }}
      >
        <Alert
          onClose={handleClose}
          severity={current?.severity || 'success'}
          variant="filled"
          sx={{ width: '100%', alignItems: 'center' }}
          action={
            <>
              {current?.action && (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => { current.action!.onClick(); handleClose(); }}
                  sx={{ fontWeight: 700, mr: 0.5 }}
                >
                  {current.action.label}
                </Button>
              )}
              <IconButton size="small" color="inherit" onClick={handleClose}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </>
          }
        >
          {current?.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';

interface ShortcutHelpProps {
  open: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: ['Ctrl', 'K'], description: '명령 팔레트 열기 (빠른 이동)' },
  { keys: ['?'], description: '단축키 도움말 표시' },
  { keys: ['Ctrl', 'Shift', 'D'], description: '다크/라이트 모드 전환' },
  { keys: ['Esc'], description: '모달/팝업 닫기' },
  { keys: ['G', '→', 'H'], description: 'Dashboard 이동' },
  { keys: ['G', '→', 'P'], description: '주차 운영 이동' },
  { keys: ['G', '→', 'S'], description: '설정 이동' },
];

export default function KeyboardShortcutsHelp({ open, onClose }: ShortcutHelpProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h3">키보드 단축키</Typography>
        <Typography variant="caption" color="text.secondary">
          관리 콘솔에서 사용할 수 있는 단축키 목록
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, py: 1 }}>
          {shortcuts.map((s, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2">{s.description}</Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {s.keys.map((key, ki) => (
                  <Chip
                    key={ki}
                    label={key}
                    size="small"
                    variant="outlined"
                    sx={{ height: 24, fontSize: '0.6875rem', fontFamily: 'monospace', fontWeight: 700, minWidth: 32 }}
                  />
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

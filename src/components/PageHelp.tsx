import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { Link, useLocation } from 'react-router-dom';
import { guideMode, guideModeLabels, resolvePageGuide, type PageGuide } from '../lib/page-guides';

export function GuideBody({ guide, onNavigate }: { guide: PageGuide; onNavigate?: () => void }) {
  const mode = guideMode(guide.path);
  return <Box sx={{ overflowWrap: 'anywhere' }}>
    <Chip size="small" label={guideModeLabels[mode]} sx={{ mb: 1.5 }} />
    <Typography sx={{ mb: 2 }}>{guide.purpose}</Typography>
    {['commissioning', 'legacy-review', 'limited', 'sandbox'].includes(mode) && <Alert severity="info" sx={{ mb: 2 }}>{guide.expected}</Alert>}
    <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>먼저 준비할 사항</Typography>
    <Box component="ul" sx={{ pl: 3, '& li': { mb: 1 } }}>{guide.setup.map(x => <li key={x}>{x}</li>)}</Box>
    <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>사용 순서</Typography>
    <Box component="ol" sx={{ pl: 3, '& li': { mb: 1 } }}>{guide.steps.map(x => <li key={x}>{x}</li>)}</Box>
    <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>완료 후 확인</Typography>
    <Typography sx={{ mt: 1, mb: 2 }}>{guide.expected}</Typography>
    <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>문제가 있을 때</Typography>
    {guide.problems.map(x => <Box key={x.problem} sx={{ mt: 1.5 }}><Typography sx={{ fontWeight: 700 }}>{x.problem}</Typography><Typography sx={{ mt: .5 }}>{x.solution}</Typography></Box>)}
    {guide.audience === 'operator' && <Alert severity="info" sx={{ mt: 2 }}>관리자 로그인 후 Google Authenticator 또는 Microsoft Authenticator의 6자리 번호로 추가 인증합니다. 처음이면 인증 앱 등록하기를 누르세요. 같은 휴대전화에서 설정할 때는 QR 아래의 수동 입력 안내를 이용할 수 있습니다.</Alert>}
    <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 2, flexWrap: 'wrap' }}>{guide.related.map(x => <Button key={x.path} component={Link} to={x.path} onClick={onNavigate} variant="outlined">{x.label}</Button>)}</Stack>
  </Box>;
}

export default function PageHelp() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const guide = resolvePageGuide(pathname);
  useEffect(() => { setOpen(false); }, [pathname]);
  return <>
    <Button aria-haspopup="dialog" aria-controls={open ? 'page-help-dialog' : undefined} onClick={() => setOpen(true)} startIcon={<ListAltIcon />} variant="contained"
      sx={{ position: 'fixed', right: { xs: 12, sm: 20 }, bottom: { xs: 'calc(84px + env(safe-area-inset-bottom))', sm: 20 }, zIndex: 1201, boxShadow: 3, minHeight: 44, px: 2, bgcolor: '#173c4b', color: '#fff', '&:hover': { bgcolor: '#21556a' } }}>
      설정·사용 안내
    </Button>
    <Dialog id="page-help-dialog" open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" aria-labelledby="page-help-title" scroll="paper">
      <DialogTitle id="page-help-title">{guide.title}</DialogTitle>
      <DialogContent dividers><GuideBody guide={guide} onNavigate={() => setOpen(false)} /></DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}><Button component={Link} to="/help" onClick={() => setOpen(false)}>전체 사용 안내</Button><Button onClick={() => setOpen(false)} autoFocus>안내 닫기</Button></DialogActions>
    </Dialog>
  </>;
}

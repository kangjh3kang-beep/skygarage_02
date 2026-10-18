import { useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface AddressResult {
  zonecode: string;
  address: string;
  roadAddress: string;
  jibunAddress: string;
  userSelectedType: 'R' | 'J';
}
interface PostcodeInstance { embed(element: HTMLElement): void }
interface PostcodeConstructor { new (options: { oncomplete: (result: AddressResult) => void; width: string; height: string; maxSuggestItems: number }): PostcodeInstance }
declare global {
  interface Window { kakao?: { Postcode?: PostcodeConstructor }; daum?: { Postcode?: PostcodeConstructor } }
}
let postcodePromise: Promise<PostcodeConstructor> | null = null;
function loadPostcode(): Promise<PostcodeConstructor> {
  const existing = window.kakao?.Postcode || window.daum?.Postcode;
  if (existing) return Promise.resolve(existing);
  if (postcodePromise) return postcodePromise;
  postcodePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;
    const failed = () => { clearTimeout(timer); script.remove(); postcodePromise = null; reject(new Error('address-service-unavailable')); };
    const timer = window.setTimeout(failed, 15000);
    script.onerror = failed;
    script.onload = () => {
      const api = window.kakao?.Postcode || window.daum?.Postcode;
      if (!api) { failed(); return; }
      clearTimeout(timer);
      resolve(api);
    };
    document.head.appendChild(script);
  });
  return postcodePromise;
}

function AddressWidget({ onSelect }: { onSelect: (address: string, postcode: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => { select.current = onSelect; }, [onSelect]);
  useEffect(() => {
    let active = true;
    const element = host.current;
    loadPostcode().then(Postcode => {
      if (!active || !element) return;
      element.replaceChildren();
      new Postcode({
        width: '100%', height: '100%', maxSuggestItems: 5,
        oncomplete: data => {
          if (!active) return;
          const address = (data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress) || data.address;
          if (address) select.current(address, data.zonecode);
        },
      }).embed(element);
      setLoading(false);
    }).catch(() => { if (active) { setFailed(true); setLoading(false); } });
    return () => { active = false; element?.replaceChildren(); };
  }, [retry]);
  return <>
    {loading && <LinearProgress aria-label="주소 검색 로딩" />}
    {failed && <Alert severity="warning" action={<Button onClick={() => { setFailed(false); setLoading(true); setRetry(value => value + 1); }}>재시도</Button>}>
      주소 검색 서비스를 불러오지 못했습니다. 창을 닫고 주소를 직접 입력할 수도 있습니다.
    </Alert>}
    <Box ref={host} sx={{ width: '100%', height: { xs: 'min(480px, 65dvh)', sm: 480 }, display: failed ? 'none' : 'block', bgcolor: '#fff' }} />
  </>;
}

export default function AddressSearchDialog({ onClose, onSelect }: { onClose: () => void; onSelect: (address: string, postcode: string) => void }) {
  return <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="address-search-title" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
    <DialogTitle id="address-search-title">주소 검색</DialogTitle>
    <DialogContent sx={{ px: { xs: 1, sm: 2 } }}>
      <Typography variant="body2" sx={{ mb: 1 }}>도로명·지번·건물명을 검색하고 주소를 선택해 주세요.</Typography>
      <AddressWidget onSelect={onSelect} />
    </DialogContent>
    <DialogActions><Button onClick={onClose}>닫기</Button></DialogActions>
  </Dialog>;
}

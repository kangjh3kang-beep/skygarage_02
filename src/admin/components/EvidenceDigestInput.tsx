import { useEffect, useRef, useState } from 'react';
import { Alert, Button, TextField, Typography } from '@mui/material';

/** Hashes a local file only. It neither uploads the file nor verifies its contents. */
export default function EvidenceDigestInput({ value, onChange, disabled, onBusy }: {
  value: string; onChange: (value: string) => void; disabled: boolean; onBusy: (busy: boolean) => void;
}) {
  const [status, setStatus] = useState(''), [error, setError] = useState('');
  const sequence = useRef(0);
  useEffect(() => () => { ++sequence.current; }, []);
  async function selectFile(file: File | undefined) {
    if (!file) return;
    const version = ++sequence.current;
    onChange(''); setError(''); setStatus(''); onBusy(false);
    if (file.size > 50 * 1024 * 1024) { setError('50MB 이하의 파일을 선택해 주세요. 이전 해시는 지웠습니다.'); return; }
    onBusy(true); setStatus(`${file.name} · 해시 계산 중`);
    try {
      const bytes = await file.arrayBuffer();
      if (sequence.current !== version) return;
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      if (sequence.current !== version) return;
      onChange(Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, '0')).join(''));
      setStatus(`${file.name} · ${file.size.toLocaleString('ko-KR')}바이트 · 계산 완료`);
    } catch {
      if (sequence.current === version) { setStatus(''); setError('파일을 읽지 못했습니다. 다시 선택하거나 검증한 해시를 직접 입력해 주세요.'); }
    } finally { if (sequence.current === version) onBusy(false); }
  }
  return <>
    <TextField required disabled={disabled} label="파일 SHA-256 · 64자리" value={value}
      onChange={e => { ++sequence.current; onBusy(false); setStatus('직접 입력한 해시 · 원본 파일과 대조해 주세요'); setError(''); onChange(e.target.value); }}
      slotProps={{ htmlInput: { pattern: '[a-fA-F0-9]{64}', maxLength: 64 } }} />
    <Button component="label" disabled={disabled}>파일에서 SHA-256 계산<input hidden aria-label="증거 해시 계산용 파일" type="file" disabled={disabled} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void selectFile(file); }} /></Button>
    <Typography variant="caption">선택한 파일은 업로드하지 않고 기기 안에서 해시만 계산합니다. 링크의 원본과 같은 파일을 선택하세요.</Typography>
    {status && <Typography role="status" variant="body2">{status}</Typography>}
    {error && <Alert severity="error">{error}</Alert>}
  </>;
}

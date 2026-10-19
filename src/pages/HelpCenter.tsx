import { useMemo, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Link } from 'react-router-dom';
import { GuideBody } from '../components/PageHelp';
import { guideMode, guideModeLabels, pageGuides } from '../lib/page-guides';

export default function HelpCenter() {
  const [query, setQuery] = useState(''), [audience, setAudience] = useState('all');
  const matches = useMemo(() => pageGuides.filter(g => !g.path.includes('*') && (audience === 'all' || audience === g.audience) &&
    `${g.title} ${g.path} ${g.purpose} ${g.setup.join(' ')} ${g.steps.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())), [query, audience]);
  return <Box component="main" sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 2, sm: 3 }, py: 4, pb: 16 }}>
    <Typography variant="overline">DOELV · 이용 도움말</Typography><Typography component="h1" variant="h4" sx={{ mb: 2 }}>설정과 사용 안내</Typography>
    <Typography sx={{ mb: 2 }}>처음 필요한 설정부터 사용 순서, 처리 결과 확인과 오류 해결까지 찾아보세요. 각 화면의 설정·사용 안내에서도 같은 내용을 볼 수 있습니다.</Typography>
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 3 }}><Button component={Link} to="/app" variant="outlined">공식 앱</Button><Button component={Link} to="/admin/start" variant="outlined">관리자 시작하기</Button><Button component={Link} to="/">PC 홈페이지</Button></Stack>
    <Alert severity="info" sx={{ mb: 3 }}>준비 중인 기능은 현재 가능한 절차와 필요한 연결을 안내합니다. 설명을 읽는 것만으로 권한이나 운영 승인이 부여되지 않습니다.</Alert>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
      <TextField fullWidth label="기능·설정·문제 검색" value={query} onChange={e => setQuery(e.target.value)} placeholder="인증 앱, 코인, 차량, 정산, 답변…" />
      <TextField select label="사용자 구분" value={audience} onChange={e => setAudience(e.target.value)} sx={{ minWidth: 180 }}><MenuItem value="all">전체</MenuItem><MenuItem value="resident">회원·입주민</MenuItem><MenuItem value="operator">관리자·운영자</MenuItem><MenuItem value="visitor">방문·소개</MenuItem></TextField>
    </Stack>
    <Typography role="status" sx={{ mb: 2 }}>검색 결과 {matches.length}개</Typography>
    {!matches.length && <Alert severity="info">검색어를 줄이거나 사용자 구분을 전체로 변경해 주세요.</Alert>}
    {matches.map(g => <Accordion key={g.path} disableGutters slotProps={{ transition: { mountOnEnter: true, unmountOnExit: true } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-label={`${g.title} ${g.path} 안내 펼치기`}><Box><Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700 }}>{g.title}</Typography><Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>{g.path}</Typography><Chip size="small" label={guideModeLabels[guideMode(g.path)]} sx={{ ml: 1 }} /></Box></AccordionSummary>
      <AccordionDetails><GuideBody guide={g} />{!g.path.includes(':') && <Button component={Link} to={g.path} sx={{ mt: 2 }}>이 화면으로 이동</Button>}</AccordionDetails>
    </Accordion>)}
  </Box>;
}

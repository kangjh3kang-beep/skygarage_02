import { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import inventory from '../../lib/page-inventory.json';
import { contractReasonLabels, labScenarios, runContractScenario } from '../../lib/mission-contract';

const modeLabels: Record<string,string> = { available:'연결됨 · 업무 인수 별도',sandbox:'시험 거래 전용',commissioning:'현장 인수 대기',limited:'안내·요청 제공','legacy-review':'기존 화면 검수 필요',redirect:'주소 연결',fallback:'없는 주소 안내' };
export default function ValidationWorkbench() {
  const [query,setQuery] = useState(''), [mode,setMode] = useState('all');
  const [results,setResults] = useState<null | {id:string;label:string;reason:string;eligible:boolean}[]>(null);
  const routes = useMemo(()=>inventory.routes.filter(r=>(mode==='all'||r.mode===mode)&&`${r.path} ${r.file} ${r.tables.join(' ')} ${r.rpcs.join(' ')}`.toLowerCase().includes(query.toLowerCase())),[query,mode]);
  function download() {
    const result={schema_version:1,observed_at:new Date().toISOString(),scope:'browser-local-contract-model',production_writes:false,field_acceptance:false,results};
    const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='skygarage-local-contract-results.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <Box sx={{maxWidth:1400,mx:'auto'}}>
    <Typography variant="overline">SKYGARAGE · 검증 센터</Typography><Typography component="h1" variant="h4" sx={{mb:2}}>페이지·연동 검증</Typography>
    <Alert severity="info" sx={{mb:2}}>전체 경로와 연결된 데이터 기능을 확인합니다. 화면 연결·시험 통과·실제 현장 인수는 별도로 판단합니다. 이 목록만으로 운영 완료를 승인하지 않습니다.</Alert>
    <Stack direction="row" spacing={1} useFlexGap sx={{mb:2,flexWrap:'wrap'}}><Chip label={`경로 ${inventory.routes.length}개`}/><Chip label={`페이지 파일 ${inventory.pageFiles.length}개`}/><Chip label={`직접 경로 없음 ${inventory.notDirectlyRouted.length}개`}/><Button component={Link} to="/admin/governance">실패·개선·독립 검수</Button><Button component={Link} to="/admin/settlement">결제·정산 시험</Button><Button component={Link} to="/admin/erp">자체 ERP</Button></Stack>
    <Card variant="outlined" sx={{mb:3}}><CardContent><Typography variant="h6">가상 명령의 실패 경로 시험</Typography><Typography sx={{my:1}}>격리된 메모리에서 정상·중복·범위 오류·통신 만료·안전 상태를 재현합니다. 장비 제어나 운영 DB 기록은 발생하지 않습니다.</Typography><Button variant="contained" onClick={()=>setResults(labScenarios.map(s=>{const r=runContractScenario(s.id);return{id:s.id,label:s.label,reason:contractReasonLabels[r.reason],eligible:r.testEligible};}))}>전체 가상 시나리오 실행</Button>{results&&<><Button onClick={download}>시험 결과 내려받기</Button>{results.map(r=><Typography key={r.id} sx={{mt:1}}>{r.label}: {r.reason} · {r.eligible?'모형 조건 충족':'거부·차단'}</Typography>)}<Alert severity="warning" sx={{mt:2}}>모형 결과입니다. 실제 장비 안전 또는 운영 인수 증거로 자동 승격되지 않습니다.</Alert></>}</CardContent></Card>
    <Stack direction={{xs:'column',sm:'row'}} spacing={2} sx={{mb:2}}><TextField fullWidth label="페이지·경로·연결 검색" value={query} onChange={e=>setQuery(e.target.value)}/><TextField select label="제공 상태" value={mode} onChange={e=>setMode(e.target.value)} sx={{minWidth:220}}><MenuItem value="all">전체</MenuItem>{Object.entries(modeLabels).map(([k,v])=><MenuItem key={k} value={k}>{v}</MenuItem>)}</TextField></Stack>
    <Typography sx={{mb:2}}>{routes.length}개 경로 · 소스에서 자동 대조한 연결 목록</Typography>
    {!routes.length&&<Alert severity="info">조건에 맞는 경로가 없습니다.</Alert>}
    {routes.map(r=><Card key={r.path} variant="outlined" sx={{mb:1.5}}><CardContent><Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:'wrap',alignItems:'center'}}><Typography component="h2" variant="h6" sx={{overflowWrap:'anywhere'}}>{r.path}</Typography><Chip size="small" label={modeLabels[r.mode]}/>{!r.path.includes('*')&&!r.path.includes(':')&&<Button component={Link} to={r.path}>페이지 열기</Button>}</Stack><Typography sx={{mt:1}}>{r.note}</Typography><Typography variant="body2" color="text.secondary" sx={{mt:1,overflowWrap:'anywhere'}}>데이터 연결: {[...r.rpcs,...r.tables,...r.functions].join(' · ')||'직접 데이터 연결 없음'} · 상호작용 요소 {r.actions}개</Typography>{r.actionReview.length>0&&<Typography color="warning.main" variant="body2">추가 검토가 필요한 상호작용 요소 {r.actionReview.length}개</Typography>}</CardContent></Card>)}
    <Typography variant="h6" sx={{mt:3}}>직접 경로가 없는 페이지 파일</Typography><Typography color="text.secondary">하위 화면으로 쓰이는 파일과 보관된 이전 화면이 함께 포함됩니다. 미구현으로 자동 판정하지 않습니다.</Typography>{inventory.notDirectlyRouted.map(f=><Typography key={f} variant="body2" sx={{overflowWrap:'anywhere'}}>{f}</Typography>)}
  </Box>;
}

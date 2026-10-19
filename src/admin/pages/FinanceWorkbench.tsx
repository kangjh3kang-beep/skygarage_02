import {useEffect,useRef,useState} from 'react';
import {Alert,Box,Button,Card,CardContent,Chip,CircularProgress,MenuItem,Stack,Tab,Tabs,TextField,Typography} from '@mui/material';
import {useAuth} from '../contexts/AuthContext';
import {supabase} from '../../lib/supabase';
import {financeError,journalCsv,moneyLabel,parseFinanceSnapshot,parseJournalExport,type FinanceSnapshot} from '../../lib/finance';
const grid={display:'grid',gridTemplateColumns:{xs:'1fr',lg:'1fr 1fr'},gap:2};
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
const batchLabels:Record<string,string>={draft:'독립 승인 대기',approved:'승인됨',payout_pending:'모의 지급 결과 대기',payout_failed:'모의 지급 실패',simulated_paid:'모의 지급 대사 완료',cancelled:'취소됨'};
export default function FinanceWorkbench(){
 const {user,role}=useAuth();const identity=`${user?.id}:${role}`;
 const [response,setResponse]=useState<{key:string;data:FinanceSnapshot|null;error:string}|null>(null),[reload,setReload]=useState(0);
 const key=`${identity}:${reload}`;const data=response?.key===key?response.data:null;
 const [tab,setTab]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const pending=useRef(new Map<string,string>()),inflight=useRef(false);
 const [facility,setFacility]=useState(''),[name,setName]=useState(''),[seller,setSeller]=useState(''),[kind,setKind]=useState('public_parking');
 const [unit,setUnit]=useState('30'),[price,setPrice]=useState('1000'),[bps,setBps]=useState('1000'),[minutes,setMinutes]=useState('60'),[credit,setCredit]=useState('10000');
 const [quote,setQuote]=useState<{id:string;gross:string;commission:string;net:string;relation:string;expires_at:string}|null>(null);
 const [refundId,setRefundId]=useState(''),[refundAmount,setRefundAmount]=useState(''),[reason,setReason]=useState('');
 const [from,setFrom]=useState(today().slice(0,7)+'-01'),[through,setThrough]=useState(today()),[closeNote,setCloseNote]=useState('');
 const [account,setAccount]=useState('cash'),[erpCode,setErpCode]=useState('');
 useEffect(()=>{setQuote(null);pending.current.clear();},[identity]);
 useEffect(()=>{
  let active=true;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  Promise.resolve(supabase.rpc('finance_snapshot',{p_environment:'sandbox'}).abortSignal(controller.signal)).then(({data,error})=>{if(error)throw error;const parsed=parseFinanceSnapshot(data);if(parsed.actor!==user?.id)throw new Error('identity_mismatch');if(active)setResponse({key,data:parsed,error:''});}).catch(e=>{if(active)setResponse({key,data:null,error:financeError(e)});}).finally(()=>clearTimeout(timer));
  return()=>{active=false;controller.abort();clearTimeout(timer);};
 },[key]);
 async function act(action:string,payload:Record<string,unknown>,label:string){
  if(inflight.current)return null;inflight.current=true;setBusy(true);setError('');setMessage('');
  const k=JSON.stringify([identity,action,payload]);let request=pending.current.get(k);if(!request){request=crypto.randomUUID();pending.current.set(k,request);}
  try{const {data,error}=await supabase.rpc('finance_command',{p_environment:'sandbox',p_request_id:request,p_action:action,p_payload:payload}).abortSignal(AbortSignal.timeout(20000));if(error)throw error;if(data?.environment!=='sandbox')throw new Error('invalid_response');pending.current.delete(k);setMessage(label);setReload(n=>n+1);return data as Record<string,unknown>;}
  catch(e){setError(financeError(e));return null;}finally{inflight.current=false;setBusy(false);}
 }
 async function download(id:string,csv:boolean){
  if(inflight.current)return;inflight.current=true;setBusy(true);setError('');
  try{const {data,error}=await supabase.rpc('finance_export_get',{p_export_id:id}).abortSignal(AbortSignal.timeout(20000));if(error)throw error;
   if(data?.id!==id||data.environment!=='sandbox'||typeof data.canonical_payload!=='string')throw new Error('invalid_export');
   const bytes=new TextEncoder().encode(data.canonical_payload);const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');if(digest!==data.digest)throw new Error('hash_mismatch');
   const payload=parseJournalExport(JSON.parse(data.canonical_payload));if(payload.export_id!==id)throw new Error('export_mismatch');
   const blob=new Blob([csv?journalCsv(payload):data.canonical_payload],{type:csv?'text/csv;charset=utf-8':'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`DOELV-SANDBOX-${id}.${csv?'csv':'json'}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('검증된 시험 전표 파일을 내려받았습니다. 실제 ERP 수신은 별도입니다.');
  }catch(e){setError(financeError(e));}finally{inflight.current=false;setBusy(false);}
 }
 const facilityName=(id:string)=>data?.facilities.find(f=>f.id===id)?.name??id;
 const chooseFacility=<TextField fullWidth select label="이용·정산 대상 시설" value={data?.facilities.some(f=>f.id===facility)?facility:''} onChange={e=>{setFacility(e.target.value);setQuote(null);}} disabled={busy}><MenuItem value="">시설 선택</MenuItem>{data?.facilities.map(f=><MenuItem key={f.id} value={f.id}>{f.name} · {f.seller_name}</MenuItem>)}</TextField>;
 return <Box sx={{maxWidth:1400,mx:'auto'}}>
  <Typography variant="overline">DOELV · FINANCE</Typography><Typography component="h1" variant="h4" sx={{fontWeight:750,mb:2}}>결제·정산·회계 검증</Typography>
  <Alert severity="warning" sx={{mb:2}}>시험 환경입니다. 시험 코인과 모형 전표만 기록하며 실제 충전·송금·ERP 반영은 실행하지 않습니다. 실제 고객 지갑과 분리되어 있습니다.</Alert>
  <Stack direction="row" spacing={1} sx={{mb:2,flexWrap:'wrap'}}><Chip label="1 원장 → 2 결제·정산 → 3 회계 교환"/><Chip label="4 실제 PG·은행·ERP 인수 대기" color="warning"/><Button disabled={busy} onClick={()=>setReload(x=>x+1)}>새로 조회</Button></Stack>
  {message&&<Alert severity="success" sx={{mb:2}}>{message}</Alert>}{(error||response?.key===key&&response.error)&&<Alert severity="error" sx={{mb:2}}>{error||response?.error}</Alert>}
  {!data&&response?.key!==key&&<CircularProgress/>}
  {data&&<>
   <Box sx={{...grid,mb:3}}><Card variant="outlined"><CardContent><Typography>내 시험 코인</Typography><Typography variant="h4">{moneyLabel(data.wallet_balance)} C</Typography><Typography color="text.secondary">최고관리자 MFA 검증 계정 · 실제 이용자 잔액 아님</Typography></CardContent></Card><Card variant="outlined"><CardContent><Typography variant="h6">내부 원장 대사 {data.reconciliation.passed?'일치':'불일치'}</Typography><Typography>전표 {data.counts.journals}개 · 결제 {data.counts.payments}건 · 마감 {data.closed_through??'없음'}</Typography><Typography color="text.secondary">은행 명세 대사·외부 ERP 확인은 미실시</Typography></CardContent></Card></Box>
   <Tabs value={tab} onChange={(_,v)=>setTab(v)} variant="scrollable" scrollButtons="auto" sx={{mb:3}}>{['시설·계약','코인·이용·환불','현장 정산','회계·ERP 교환'].map(x=><Tab key={x} label={x}/>)}</Tabs>
   {tab===0&&<Box sx={grid}>
    <Card variant="outlined"><CardContent><Typography variant="h6">시험 시설·수취 운영사</Typography><Stack component="form" spacing={2} sx={{mt:2}} onSubmit={e=>{e.preventDefault();void act('facility_create',{name,seller_name:seller,kind},'시험 시설을 등록했습니다.');}}>
     <TextField required label="시험 시설명" value={name} onChange={e=>setName(e.target.value)} slotProps={{htmlInput:{minLength:2,maxLength:120}}}/><TextField required label="시험 운영사명" value={seller} onChange={e=>setSeller(e.target.value)} slotProps={{htmlInput:{minLength:2,maxLength:120}}}/>
     <TextField select label="시설 유형" value={kind} onChange={e=>setKind(e.target.value)}><MenuItem value="residential">주거단지</MenuItem><MenuItem value="public_parking">일반 주차시설</MenuItem></TextField><Button type="submit" disabled={busy} variant="contained">시험 시설 등록</Button>
    </Stack></CardContent></Card>
    <Card variant="outlined"><CardContent><Typography variant="h6">요금·수수료 계약 버전</Typography><Stack component="form" spacing={2} sx={{mt:2}} onSubmit={e=>{e.preventDefault();void act('tariff_create',{facility_id:facility,unit_minutes:unit,unit_price:price,commission_bps:bps},'새 요금 계약 버전을 등록했습니다. 기존 견적은 이전 조건을 유지합니다.');}}>{chooseFacility}
     <TextField required type="number" label="과금 단위 · 분" value={unit} onChange={e=>setUnit(e.target.value)} slotProps={{htmlInput:{min:1,max:1440,step:1}}}/><TextField required type="number" label="단위당 시험 코인" value={price} onChange={e=>setPrice(e.target.value)} slotProps={{htmlInput:{min:1,max:1000000,step:1}}}/><TextField required type="number" label="본사 수수료 · bps (100bps = 1%)" value={bps} onChange={e=>setBps(e.target.value)} slotProps={{htmlInput:{min:0,max:10000,step:1}}}/><Typography variant="caption">표시된 초기값은 시험 예시이며 실제 계약 요율이 아닙니다.</Typography><Button type="submit" disabled={busy||!facility} variant="outlined">계약 버전 추가</Button>
    </Stack></CardContent></Card>
   </Box>}
   {tab===1&&<>
    <Box sx={grid}><Card variant="outlined"><CardContent><Typography variant="h6">내 시험 지갑·소속 설정</Typography><Stack spacing={2} sx={{mt:2}}><TextField select label="내 소속 시설 · 요금 관계 확인용" value={data.home_facility_id??''} onChange={e=>void act('membership_set',{facility_id:e.target.value||null},'시험 소속을 반영했습니다.')} disabled={busy}><MenuItem value="">소속 없음</MenuItem>{data.facilities.map(f=><MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}</TextField><TextField type="number" label="발급할 시험 코인" value={credit} onChange={e=>setCredit(e.target.value)}/><Button disabled={busy} onClick={()=>void act('test_credit',{amount:credit},'시험 코인을 발급했습니다. 실제 결제가 아닙니다.')}>시험 코인 발급</Button><Typography color="text.secondary">정산금은 내 소속과 관계없이 실제 이용한 시설의 운영사에 귀속됩니다.</Typography></Stack></CardContent></Card>
    <Card variant="outlined"><CardContent><Typography variant="h6">이용시설 견적·시험 결제</Typography><Stack spacing={2} sx={{mt:2}}>{chooseFacility}<TextField type="number" label="시험 이용시간 · 분" value={minutes} onChange={e=>{setMinutes(e.target.value);setQuote(null);}}/><Button disabled={busy||!facility} onClick={()=>void act('quote',{facility_id:facility,minutes},'서버 요금 계약으로 견적을 생성했습니다.').then(q=>{if(q)setQuote(q as typeof quote);})}>견적 생성</Button>
     {quote&&<Alert severity="info">총 {moneyLabel(quote.gross)} C = 본사 {moneyLabel(quote.commission)} C + 시설 {moneyLabel(quote.net)} C<br/>{quote.relation==='home'?'소속 시설':quote.relation==='away'?'외부 시설':'무소속 이용'} · {new Date(quote.expires_at).toLocaleTimeString('ko-KR')}까지 유효</Alert>}
     <Button variant="contained" disabled={busy||!quote} onClick={()=>quote&&void act('pay',{quote_id:quote.id},'시험 결제·배분·전표를 함께 기록했습니다.').then(r=>{if(r)setQuote(null);})}>시험 코인으로 결제</Button></Stack></CardContent></Card></Box>
    <Card variant="outlined" sx={{mt:2}}><CardContent><Typography variant="h6">부분·전체 환불</Typography><Stack spacing={2} sx={{mt:2}}><TextField select label="환불할 결제 · 최근 200건" value={refundId} onChange={e=>setRefundId(e.target.value)}><MenuItem value="">결제 선택</MenuItem>{data.payments.filter(p=>BigInt(p.gross)>BigInt(p.refunded)).map(p=><MenuItem key={p.id} value={p.id}>{facilityName(p.facility_id)} · 잔여 {moneyLabel((BigInt(p.gross)-BigInt(p.refunded)).toString())} C · {p.id.slice(0,8)}</MenuItem>)}</TextField><TextField type="number" label="환불 시험 코인" value={refundAmount} onChange={e=>setRefundAmount(e.target.value)}/><TextField label="환불 사유 · 5자 이상" value={reason} onChange={e=>setReason(e.target.value)}/><Button disabled={busy||!refundId||reason.trim().length<5} onClick={()=>void act('refund',{payment_id:refundId,amount:refundAmount,reason},'시험 환불과 배분 역분개를 기록했습니다.')}>환불 기록</Button><Typography color="text.secondary">진행 중인 정산은 취소 후 환불합니다. 모의 지급이 완료된 뒤의 환불은 다음 정산에서 차감합니다.</Typography></Stack></CardContent></Card>
   </>}
   {tab===2&&<><Card variant="outlined" sx={{mb:2}}><CardContent><Stack spacing={2}>{chooseFacility}<TextField type="date" label="정산 대상 종료일 · 한국시간" value={through} onChange={e=>setThrough(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/><Button disabled={busy||!facility} variant="contained" onClick={()=>void act('batch_create',{facility_id:facility,through_date:through},'대상 거래 전체를 집계했습니다. 다른 최고관리자의 승인이 필요합니다.')}>정산 배치 생성</Button></Stack></CardContent></Card>
    <Typography sx={{mb:2}}>최근 {data.batches.length} / 전체 {data.counts.batches}건. 배치 계산은 화면의 조회 한도와 관계없이 전체 대상 거래를 사용합니다.</Typography>
    {data.batches.map(b=><Card key={b.id} variant="outlined" sx={{mb:2}}><CardContent><Chip label={batchLabels[b.status]}/><Typography variant="h6" sx={{mt:1}}>{facilityName(b.facility_id)} · 순정산 {moneyLabel(b.net)} C</Typography><Typography>{b.item_count}개 조정 포함 · 총액 {moneyLabel(b.gross)} / 본사 {moneyLabel(b.commission)}</Typography><Stack direction="row" spacing={1} useFlexGap sx={{mt:2,flexWrap:'wrap'}}>
     {b.status==='draft'&&<Button disabled={busy||b.created_by===data.actor} onClick={()=>void act('batch_approve',{batch_id:b.id},'독립 승인을 기록했습니다.')}>독립 승인</Button>}
     {['draft','approved','payout_failed'].includes(b.status)&&<Button disabled={busy} onClick={()=>void act('batch_cancel',{batch_id:b.id},'정산 배치를 취소하고 거래를 대기 상태로 돌렸습니다.')}>배치 취소</Button>}
     {['approved','payout_failed'].includes(b.status)&&<Button disabled={busy||b.created_by===data.actor||(b.attempts??0)>=5} onClick={()=>void act('payout_request',{batch_id:b.id},'모의 지급 요청을 기록했습니다. 결과 확인 전까지 지급 완료가 아닙니다.')}>모의 지급 요청</Button>}
     {b.status==='payout_pending'&&['unknown','failed','succeeded'].map(outcome=><Button key={outcome} disabled={busy||b.created_by===data.actor} onClick={()=>void act('simulate_payout_result',{batch_id:b.id,amount:b.net,outcome,receipt:`SIM-${b.id}-${b.attempts}-${outcome}`},'모의 지급 결과와 원장을 대사했습니다.')}>{outcome==='unknown'?'미확정 재현':outcome==='failed'?'실패 재현':'성공·대사 재현'}</Button>)}
    </Stack>{b.created_by===data.actor&&b.status==='draft'&&<Typography variant="caption">다른 최고관리자 계정의 MFA 로그인 후 승인할 수 있습니다.</Typography>}</CardContent></Card>)}</>}
   {tab===3&&<>
    <Box sx={grid}>{data.accounts.map(a=><Card key={a.code} variant="outlined"><CardContent><Typography variant="subtitle2">{a.name} · {a.erp_code}</Typography><Typography>차변 {moneyLabel(a.debit)} · 대변 {moneyLabel(a.credit)}</Typography></CardContent></Card>)}</Box>
    <Box sx={{...grid,mt:2}}><Card variant="outlined"><CardContent><Typography variant="h6">ERP 교환 파일</Typography><Stack spacing={2} sx={{mt:2}}><TextField select label="내부 계정" value={account} onChange={e=>setAccount(e.target.value)}>{data.accounts.map(a=><MenuItem key={a.code} value={a.code}>{a.name}</MenuItem>)}</TextField><TextField label="시험 ERP 계정코드" value={erpCode} onChange={e=>setErpCode(e.target.value)} helperText="영문·숫자·밑줄·하이픈, 1~40자"/><Button disabled={busy||!erpCode} onClick={()=>void act('account_map',{account,erp_code:erpCode},'다음 내보내기에 적용할 계정 매핑을 저장했습니다.')}>계정 매핑</Button><TextField type="date" label="시작일" value={from} onChange={e=>setFrom(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/><TextField type="date" label="종료일 · 한국시간" value={through} onChange={e=>setThrough(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/><Button disabled={busy} variant="contained" onClick={()=>void act('export_prepare',{from_date:from,to_date:through},'미전송 전표를 고정된 교환 파일로 생성했습니다.')}>전표 교환 파일 생성</Button><Typography color="text.secondary">DOELV 내부 교환 형식입니다. 실제 ERP 제품별 변환·전송과 세무 전표 승인은 별도입니다.</Typography></Stack></CardContent></Card>
    <Card variant="outlined"><CardContent><Typography variant="h6">시험 기간 마감</Typography><Alert severity="warning" sx={{my:2}}>선택한 종료일까지의 전표를 모두 독립 확인해야 합니다. 오늘까지 마감하면 오늘의 새 시험 결제·충전·환불도 차단됩니다. 재개방 기능은 없습니다.</Alert><TextField fullWidth multiline label="마감 사유 · 5자 이상" value={closeNote} onChange={e=>setCloseNote(e.target.value)}/><Button sx={{mt:2}} disabled={busy||closeNote.trim().length<5} onClick={()=>void act('period_close',{through_date:through,note:closeNote},'시험 기간을 마감했습니다.')}>{through}까지 마감</Button></CardContent></Card></Box>
    <Typography sx={{my:2}}>최근 교환 파일 {data.exports.length} / 전체 {data.counts.exports}개</Typography>
    {data.exports.map(e=><Card key={e.id} variant="outlined" sx={{mb:2}}><CardContent><Typography>{e.from_date} ~ {e.to_date} · {e.row_count}행 · {e.status==='prepared'?'수신 확인 대기':'모의 수신 확인'}</Typography><Typography variant="caption" sx={{overflowWrap:'anywhere'}}>SHA-256 {e.digest}</Typography><Stack direction="row" spacing={1} sx={{mt:1}}><Button disabled={busy} onClick={()=>void download(e.id,false)}>JSON</Button><Button disabled={busy} onClick={()=>void download(e.id,true)}>CSV</Button>{e.status==='prepared'&&<Button disabled={busy||e.created_by===data.actor} onClick={()=>void act('simulate_erp_ack',{export_id:e.id,digest:e.digest,row_count:e.row_count,receipt:`SIM-ERP-${e.id}`},'독립 모의 ERP 수신 확인을 기록했습니다. 실제 ERP 수신 확인은 아닙니다.')}>독립 모의 수신 확인</Button>}</Stack></CardContent></Card>)}
   </>}
  </>}
 </Box>;
}

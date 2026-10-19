import {useEffect,useRef,useState} from 'react';
import {Alert,Box,Button,Card,CardContent,Checkbox,Chip,CircularProgress,FormControlLabel,MenuItem,Stack,Tab,Tabs,Table,TableBody,TableCell,TableContainer,TableHead,TableRow,TextField,Typography} from '@mui/material';
import {Link} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';
import {supabase} from '../../lib/supabase';
import {moneyLabel} from '../../lib/finance';
import {erpCsv,erpError,parseErpDocument,parseErpReport,parseErpSnapshot,type ErpSnapshot,type ErpReport,type ErpLine} from '../../lib/erp';

const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
const grid={display:'grid',gridTemplateColumns:{xs:'1fr',lg:'1fr 1fr'},gap:2};
const kinds:Record<string,string>={asset:'자산',liability:'부채',equity:'자본',income:'수익',expense:'비용'};
const sourceLabels={manual:'수기',finance:'결제·정산',reversal:'역분개'};
const statusLabels={draft:'승인 대기',posted:'장부 반영',void:'초안 취소'};
const freshLines=()=>[{line_no:1,account_code:'TEST_1000',debit:'0',credit:'0',party_id:null,cost_center_id:null},{line_no:2,account_code:'TEST_3000',debit:'0',credit:'0',party_id:null,cost_center_id:null}] as ErpLine[];
const auditLabels:Record<string,string>={voucher_save:'전표 저장',voucher_post:'전표 승인 요청',voucher_posted:'장부 반영',voucher_void:'초안 취소',voucher_reverse:'역분개 생성',finance_received:'원천 전표 수신',finance_posted:'원천 전표 반영',period_closed:'기간 마감',account_create:'계정 등록',party_create:'거래처 등록',cost_center_create:'시설·부문 등록',book_create:'장부 생성',provider_plan:'연동 계획 변경'};

export default function ErpWorkbench(){
 const {user,role}=useAuth();const identity=`${user?.id}:${role}`;const identityRef=useRef(identity);identityRef.current=identity;
 const [bookId,setBookId]=useState(''),[reload,setReload]=useState(0),[tab,setTab]=useState(0);
 const key=`${identity}:${bookId}:${reload}`;
 const [response,setResponse]=useState<{key:string;data:ErpSnapshot|null;error:string}|null>(null);
 const data=response?.key===key?response.data:null;
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const pending=useRef(new Map<string,string>()),inflight=useRef(false);
 const [from,setFrom]=useState(today().slice(0,7)+'-01'),[through,setThrough]=useState(today()),[filterCenter,setFilterCenter]=useState(''),[after,setAfter]=useState('0');
 const reportKey=`${key}:${from}:${through}:${filterCenter}:${after}`;
 const [reportResponse,setReportResponse]=useState<{key:string;data:ErpReport|null;error:string}|null>(null);
 const report=reportResponse?.key===reportKey?reportResponse.data:null;
 const [voucherId,setVoucherId]=useState(''),[entryDate,setEntryDate]=useState(today()),[note,setNote]=useState(''),[evidence,setEvidence]=useState(''),[lines,setLines]=useState<ErpLine[]>(freshLines);
 const [reason,setReason]=useState(''),[reverseDate,setReverseDate]=useState(today()),[closeNote,setCloseNote]=useState('');
 const [voucherDocument,setVoucherDocument]=useState<ReturnType<typeof parseErpDocument>|null>(null);
 const [bookCode,setBookCode]=useState(''),[bookName,setBookName]=useState('');
 const [accountCode,setAccountCode]=useState(''),[accountName,setAccountName]=useState(''),[accountKind,setAccountKind]=useState('expense'),[requiresParty,setRequiresParty]=useState(false);
 const [partyCode,setPartyCode]=useState(''),[partyName,setPartyName]=useState(''),[partyKind,setPartyKind]=useState('supplier');
 const [centerCode,setCenterCode]=useState(''),[centerName,setCenterName]=useState('');
 const [providerKind,setProviderKind]=useState('payment'),[vendorCode,setVendorCode]=useState(''),[vendorName,setVendorName]=useState('');
 function resetDraft(){setVoucherId('');setEntryDate(today());setNote('');setEvidence('');setLines(freshLines());}
 useEffect(()=>{pending.current.clear();setVoucherDocument(null);resetDraft();setAfter('0');setFilterCenter('');setError('');setMessage('');},[identity,bookId]);
 useEffect(()=>{setAfter('0');},[from,through,filterCenter]);
 useEffect(()=>{
  let active=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  Promise.resolve(supabase.rpc('erp_snapshot',{p_book_id:bookId||null}).abortSignal(controller.signal)).then(({data,error})=>{
   if(error)throw error;const parsed=parseErpSnapshot(data);if(parsed.actor!==user?.id||(bookId&&parsed.book.id!==bookId))throw Error('erp_identity_mismatch');if(active)setResponse({key,data:parsed,error:''});
  }).catch(e=>{if(active)setResponse({key,data:null,error:erpError(e)});}).finally(()=>clearTimeout(timer));
  return()=>{active=false;controller.abort();clearTimeout(timer);};
 },[key]);
 useEffect(()=>{
  if(tab!==2||!data)return;
  let active=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  Promise.resolve(supabase.rpc('erp_report',{p_book_id:data.book.id,p_from:from,p_to:through,p_cost_center:filterCenter||null,p_after:after}).abortSignal(controller.signal)).then(({data:r,error})=>{
   if(error)throw error;const parsed=parseErpReport(r);if(parsed.book_id!==data.book.id||parsed.from_date!==from||parsed.to_date!==through||parsed.cost_center_id!==(filterCenter||null))throw Error('erp_report_mismatch');if(active)setReportResponse({key:reportKey,data:parsed,error:''});
  }).catch(e=>{if(active)setReportResponse({key:reportKey,data:null,error:erpError(e)});}).finally(()=>clearTimeout(timer));
  return()=>{active=false;controller.abort();clearTimeout(timer);};
 },[reportKey,tab,data]);
 async function act(action:string,payload:Record<string,unknown>,label:string){
  if(inflight.current||!data)return null;inflight.current=true;setBusy(true);setError('');setMessage('');
  const captured=identity,p={book_id:data.book.id,...payload},k=JSON.stringify([identity,action,p]);
  let request=pending.current.get(k);if(!request){request=crypto.randomUUID();pending.current.set(k,request);}
  try{const {data:r,error}=await supabase.rpc('erp_command',{p_environment:'sandbox',p_request_id:request,p_action:action,p_payload:p}).abortSignal(AbortSignal.timeout(25000));if(error)throw error;if(r?.environment!=='sandbox')throw Error('erp_invalid_response');if(captured!==identityRef.current)return null;pending.current.delete(k);setVoucherDocument(null);setMessage(label);setReload(x=>x+1);return r as Record<string,unknown>;}
  catch(e){if(captured===identityRef.current)setError(erpError(e));return null;}finally{inflight.current=false;setBusy(false);}
 }
 async function openDocument(id:string,edit=false){
  if(inflight.current||!data)return;inflight.current=true;setBusy(true);setError('');const captured=identity;
  try{const {data:r,error}=await supabase.rpc('erp_document',{p_voucher_id:id}).abortSignal(AbortSignal.timeout(15000));if(error)throw error;const parsed=parseErpDocument(r);if(parsed.voucher.id!==id||parsed.voucher.book_id!==data.book.id)throw Error('erp_document_mismatch');if(captured!==identityRef.current)return;setVoucherDocument(parsed);
   if(edit){setVoucherId(id);setEntryDate(parsed.voucher.entry_date);setNote(parsed.voucher.note);setEvidence(parsed.voucher.evidence_ref);setLines(parsed.lines);}
  }catch(e){if(captured===identityRef.current)setError(erpError(e));}finally{inflight.current=false;setBusy(false);}
 }
 function download(name:string,body:string,mime:string){const url=URL.createObjectURL(new Blob([body],{type:mime}));const a=window.document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function setLine(index:number,field:keyof ErpLine,value:string){setLines(xs=>xs.map((x,i)=>i===index?{...x,[field]:value||(['party_id','cost_center_id'].includes(field)?null:'')}:x));}
 const reportDates=<Stack direction={{xs:'column',sm:'row'}} spacing={2}><TextField type="date" label="시작일" value={from} onChange={e=>setFrom(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/><TextField type="date" label="종료일 · 한국시간" value={through} onChange={e=>setThrough(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/></Stack>;
 const simpleTable=(headers:string[],rows:(string|number)[][])=><TableContainer><Table size="small"><TableHead><TableRow>{headers.map(h=><TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead><TableBody>{rows.map((r,i)=><TableRow key={i}>{r.map((v,j)=><TableCell key={j} sx={{whiteSpace:'nowrap'}}>{v}</TableCell>)}</TableRow>)}</TableBody></Table></TableContainer>;
 return <Box sx={{maxWidth:1500,mx:'auto'}}>
  <Stack direction={{xs:'column',sm:'row'}} spacing={2} sx={{mb:2,justifyContent:"space-between"}}><Box><Typography variant="overline" color="primary">DOELV · OWN ERP</Typography><Typography variant="h4" component="h1" sx={{fontWeight:750}}>자체 ERP 회계</Typography></Box><Stack direction="row" spacing={1}><Button component={Link} to="/admin/settlement">결제·정산</Button><Button disabled={busy} onClick={()=>setReload(x=>x+1)}>새로 조회</Button></Stack></Stack>
  <Alert severity="info" sx={{mb:2}}>자체 ERP에 전표를 저장하고 승인·대사합니다. 현재 연결된 원천은 시험 코인 장부입니다. PG·실제 지급은 업체 지정과 연동 후 사용할 수 있습니다.</Alert>
  {message&&<Alert severity="success" sx={{mb:2}}>{message}</Alert>}{(error||(response?.key===key&&response.error))&&<Alert severity="error" sx={{mb:2}}>{error||response?.error}</Alert>}
  {!data&&response?.key!==key&&<CircularProgress/>}
  {data&&<>
   <TextField select fullWidth label="회계 장부" value={data.book.id} disabled={busy} onChange={e=>setBookId(e.target.value)} sx={{mb:2}}>{data.books.map(b=><MenuItem key={b.id} value={b.id}>{b.name} · {b.finance_source?'결제·정산 연결':'독립 장부'} · 시험</MenuItem>)}</TextField>
   <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr 1fr',md:'repeat(4,1fr)'},gap:2,mb:2}}>{[
    ['장부 반영',`${data.counts.posted}건`],['승인 대기',`${data.counts.draft}건`],['원천 대사',data.reconciliation.source_mismatches?'불일치':data.reconciliation.source_reconciled?'일치':'전송·승인 대기'],['마감일',data.book.closed_through??'미마감'],
   ].map(([label,value])=><Card key={label} variant="outlined"><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h6" sx={{fontWeight:700}}>{value}</Typography></CardContent></Card>)}</Box>
   {!data.reconciliation.balanced||data.reconciliation.source_mismatches>0?<Alert severity="error" sx={{mb:2}}>원장 또는 원천 대사가 일치하지 않습니다. 승인·마감 전 원인을 확인해야 합니다.</Alert>:null}
   <Tabs value={tab} onChange={(_,x)=>setTab(x)} variant="scrollable" sx={{mb:3}}>{['수신·승인','수기 전표·역분개','회계 보고서','기준정보·연동 계획'].map(x=><Tab key={x} label={x}/>)}</Tabs>
   {tab===0&&<>
    {data.book.finance_source&&<Card variant="outlined" sx={{mb:2}}><CardContent><Typography variant="h6">결제·정산 원장 연결</Typography><Typography sx={{my:1}}>미전송 전표 {data.reconciliation.source_unexported}개 · 미반영 묶음 {data.reconciliation.source_unposted}개. 수신과 승인은 분리됩니다.</Typography>{reportDates}<Button sx={{mt:2}} disabled={busy} variant="contained" onClick={()=>void act('finance_sync',{from_date:from,to_date:through},'원천 전표를 자체 ERP 승인 대기함으로 가져왔습니다.')}>선택 기간의 미전송 전표 가져오기</Button></CardContent></Card>}
    {data.pending_exports.map(e=><Alert severity="warning" key={e.id} sx={{mb:1}} action={<Button disabled={busy} onClick={()=>void act('finance_receive',{export_id:e.id},'이전 교환 전표를 자체 ERP에 수신했습니다.')}>가져오기</Button>}>{e.from_date} ~ {e.to_date} 이전 교환 파일 · 자체 ERP 미수신</Alert>)}
    <Typography variant="h6">원천 전표 승인 대기함</Typography><Typography color="text.secondary" sx={{mb:2}}>승인 대기 우선 최대 100개 · 전체 {data.import_count}개. 작성자와 다른 관리자가 묶음 전체를 승인합니다.</Typography>
    {data.imports.length===0&&<Alert severity="info">아직 수신한 원천 전표가 없습니다.</Alert>}
    {data.imports.map(i=><Card variant="outlined" key={i.id} sx={{mb:2}}><CardContent><Stack direction={{xs:'column',sm:'row'}} spacing={1} sx={{justifyContent:"space-between"}}><Box><Chip size="small" color={i.status==='posted'?'success':'warning'} label={i.status==='posted'?'자체 ERP 반영 완료':'독립 승인 대기'}/><Typography variant="h6" sx={{mt:1}}>전표 {i.journal_count}개 · 분개 {i.row_count}행</Typography><Typography variant="caption" sx={{overflowWrap:'anywhere'}}>원천 {i.export_id}</Typography></Box>{i.status==='received'&&<Button variant="contained" disabled={busy||i.created_by===data.actor} onClick={()=>void act('import_post',{import_id:i.id},'자체 ERP 장부 반영과 원천 수신 확인을 함께 완료했습니다.')}>대사 후 장부 반영</Button>}</Stack>{i.created_by===data.actor&&i.status==='received'&&<Typography color="text.secondary" sx={{mt:1}}>다른 최고관리자 계정에서 승인해 주세요.</Typography>}</CardContent></Card>)}
    <Card variant="outlined"><CardContent><Typography variant="h6">회계 기간 마감</Typography><Alert severity="warning" sx={{my:2}}>종료일까지의 모든 전표를 승인하거나 초안 취소해야 합니다. 결제 연결 장부는 원천 대사와 현장 정산도 확인합니다. 마감된 기간은 다시 열 수 없습니다.</Alert><Stack spacing={2}><TextField type="date" label="마감 종료일" value={through} onChange={e=>setThrough(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/><TextField label="마감 근거 · 5자 이상" value={closeNote} onChange={e=>setCloseNote(e.target.value)}/><Button disabled={busy||closeNote.trim().length<5} onClick={()=>void act('period_close',{through_date:through,note:closeNote},'회계 기간을 마감했습니다. 결제 연결 장부는 원천 기간도 함께 마감됩니다.')}>{through}까지 마감</Button></Stack></CardContent></Card>
   </>}
   {tab===1&&<>
    <Card variant="outlined" sx={{mb:3}}><CardContent><Typography variant="h6">{voucherId?'내 수기 초안 수정':'수기 전표 작성'}</Typography><Typography color="text.secondary" sx={{mb:2}}>원천 결제 전표의 정정은 결제·정산 메뉴의 환불·조정으로 처리합니다.</Typography>
     <Stack component="form" spacing={2} onSubmit={e=>{e.preventDefault();void act('voucher_save',{voucher_id:voucherId||null,entry_date:entryDate,note,evidence_ref:evidence,lines},'수기 초안을 저장했습니다. 다른 관리자의 승인이 필요합니다.').then(r=>{if(r)resetDraft();});}}>
      <TextField required disabled={busy} type="date" label="전표일" value={entryDate} onChange={e=>setEntryDate(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/><TextField required disabled={busy} label="적요 · 5자 이상" value={note} onChange={e=>setNote(e.target.value)} slotProps={{htmlInput:{minLength:5,maxLength:500}}}/><TextField required disabled={busy} label="증빙 참조번호" helperText="문서번호 또는 보관 위치를 기록합니다. 증빙의 진위 확인은 승인자가 수행합니다." value={evidence} onChange={e=>setEvidence(e.target.value)} slotProps={{htmlInput:{minLength:3,maxLength:200}}}/>
      {lines.map((l,index)=><Box key={index} sx={{border:'1px solid',borderColor:'divider',borderRadius:2,p:2}}><Typography variant="subtitle2" sx={{mb:1}}>분개 {index+1}</Typography><Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',md:'2fr 1fr 1fr'},gap:1}}>
       <TextField select label="계정과목" disabled={busy} value={l.account_code} onChange={e=>setLine(index,'account_code',e.target.value)}>{data.accounts.map(a=><MenuItem key={a.code} value={a.code}>{a.code} · {a.name}</MenuItem>)}</TextField><TextField required disabled={busy} label="차변" type="number" value={l.debit} onChange={e=>setLine(index,'debit',e.target.value)} slotProps={{htmlInput:{min:0,step:1,max:1000000000000}}}/><TextField required disabled={busy} label="대변" type="number" value={l.credit} onChange={e=>setLine(index,'credit',e.target.value)} slotProps={{htmlInput:{min:0,step:1,max:1000000000000}}}/>
       <TextField select disabled={busy} label="거래처" value={l.party_id??''} onChange={e=>setLine(index,'party_id',e.target.value)}><MenuItem value="">미지정</MenuItem>{data.parties.map(p=><MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}</TextField><TextField select disabled={busy} label="시설·부문" value={l.cost_center_id??''} onChange={e=>setLine(index,'cost_center_id',e.target.value)}><MenuItem value="">미지정</MenuItem>{data.cost_centers.map(c=><MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}</TextField><Button disabled={busy||lines.length<=2} onClick={()=>setLines(xs=>xs.filter((_,i)=>i!==index).map((x,i)=>({...x,line_no:i+1})))}>행 삭제</Button>
      </Box></Box>)}
      <Stack direction="row" spacing={1}><Button disabled={busy||lines.length>=20} onClick={()=>setLines(xs=>[...xs,{...freshLines()[0],line_no:xs.length+1}])}>분개 행 추가</Button><Button variant="contained" type="submit" disabled={busy}>초안 저장</Button>{voucherId&&<Button disabled={busy} onClick={resetDraft}>새 전표</Button>}</Stack>
     </Stack>
    </CardContent></Card>
    <Stack direction={{xs:'column',sm:'row'}} spacing={2} sx={{mb:2}}><TextField fullWidth label="초안 취소·역분개 사유 · 5자 이상" value={reason} onChange={e=>setReason(e.target.value)}/><TextField type="date" label="역분개일" value={reverseDate} onChange={e=>setReverseDate(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/></Stack>
    <Typography variant="h6">전표 조회·승인</Typography><Typography color="text.secondary" sx={{mb:2}}>초안 우선 최대 100개 · 전체 {data.counts.vouchers}개. 반영 전표 전체 내역은 회계 보고서에서 페이지별로 조회할 수 있습니다.</Typography>
    {data.vouchers.map(v=><Card variant="outlined" key={v.id} sx={{mb:1}}><CardContent><Stack direction={{xs:'column',md:'row'}} spacing={1} sx={{justifyContent:"space-between"}}><Box><Typography sx={{fontWeight:700}}>#{v.number} · {v.note}</Typography><Typography color="text.secondary">{v.entry_date} · {sourceLabels[v.source]} · {statusLabels[v.status]}</Typography></Box><Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:"wrap"}}><Button disabled={busy} onClick={()=>void openDocument(v.id)}>분개 보기</Button>
     {v.status==='draft'&&v.source==='manual'&&v.created_by===data.actor&&<Button disabled={busy} onClick={()=>void openDocument(v.id,true)}>수정</Button>}
     {v.status==='draft'&&v.source!=='finance'&&<><Button disabled={busy||v.created_by===data.actor} onClick={()=>void act('voucher_post',{voucher_id:v.id},'독립 승인하여 장부에 반영했습니다.')}>승인</Button><Button disabled={busy||reason.trim().length<5} onClick={()=>void act('voucher_void',{voucher_id:v.id,reason},'초안을 취소했습니다.')}>초안 취소</Button></>}
     {v.status==='posted'&&v.source!=='finance'&&<Button disabled={busy||reason.trim().length<5} onClick={()=>void act('voucher_reverse',{voucher_id:v.id,entry_date:reverseDate,reason},'원전표를 보존하고 역분개 초안을 생성했습니다.')}>역분개 작성</Button>}
    </Stack></Stack></CardContent></Card>)}
    {voucherDocument&&<Card variant="outlined" sx={{mt:2}}><CardContent><Typography variant="h6">#{voucherDocument.voucher.number} 분개 · {voucherDocument.voucher.evidence_ref}</Typography>{simpleTable(['계정','거래처','시설·부문','차변','대변'],voucherDocument.lines.map(l=>[data.accounts.find(a=>a.code===l.account_code)?.name??l.account_code,data.parties.find(p=>p.id===l.party_id)?.name??'—',data.cost_centers.find(c=>c.id===l.cost_center_id)?.name??'—',moneyLabel(l.debit),moneyLabel(l.credit)]))}</CardContent></Card>}
   </>}
   {tab===2&&<>
    <Stack spacing={2} sx={{mb:3}}>{reportDates}<TextField select label="시설·부문 필터" value={filterCenter} onChange={e=>setFilterCenter(e.target.value)}><MenuItem value="">장부 전체</MenuItem>{data.cost_centers.map(c=><MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}</TextField><Alert severity="info">승인·반영된 전표 전체를 집계합니다. 시험 장부의 내부 관리 보고서이며 세무 신고서나 은행 대사 완료 증빙은 아닙니다.</Alert></Stack>
    {!report&&reportResponse?.key!==reportKey&&<CircularProgress/>}{reportResponse?.key===reportKey&&reportResponse.error&&<Alert severity="error">{reportResponse.error}</Alert>}
    {report&&<>
     <Box sx={grid}><Card variant="outlined"><CardContent><Typography variant="h6">기간 손익</Typography>{simpleTable(['항목','금액'],[['수익',moneyLabel(report.profit_loss.income)],['비용',moneyLabel(report.profit_loss.expense)],['손익',moneyLabel(report.profit_loss.profit)]])}</CardContent></Card><Card variant="outlined"><CardContent><Typography variant="h6">종료일 재무상태</Typography>{simpleTable(['항목','금액'],[['자산',moneyLabel(report.balance_sheet.assets)],['부채',moneyLabel(report.balance_sheet.liabilities)],['자본',moneyLabel(report.balance_sheet.equity)],['누적 손익',moneyLabel(report.balance_sheet.accumulated_result)],['차이',moneyLabel(report.balance_sheet.difference)]])}</CardContent></Card></Box>
     <Card variant="outlined" sx={{my:2}}><CardContent><Stack direction="row" sx={{justifyContent:"space-between"}}><Typography variant="h6">합계잔액 시산표</Typography><Button onClick={()=>download(`ERP-TRIAL-${through}.csv`,erpCsv(report.trial_balance,['code','name','kind','opening','debit','credit','closing']),'text/csv;charset=utf-8')}>CSV</Button></Stack>{simpleTable(['계정','기초 차변잔액','차변','대변','기말 차변잔액'],report.trial_balance.map(a=>[a.name,moneyLabel(a.opening),moneyLabel(a.debit),moneyLabel(a.credit),moneyLabel(a.closing)]))}<Typography variant="caption">대변 성격의 잔액은 음수로 표시됩니다.</Typography></CardContent></Card>
     <Card variant="outlined" sx={{mb:2}}><CardContent><Typography variant="h6">거래처별 계정 잔액</Typography>{simpleTable(['거래처','계정','차변잔액'],report.party_balances.map(p=>[p.name,p.account_name,moneyLabel(p.balance)]))}</CardContent></Card>
     <Card variant="outlined"><CardContent><Typography variant="h6">총계정원장 · 현재 페이지</Typography><Stack direction="row" spacing={1} useFlexGap sx={{my:1,flexWrap:"wrap"}}><Button disabled={after==='0'} onClick={()=>setAfter('0')}>처음</Button><Button disabled={!report.next_after||report.ledger.length===0} onClick={()=>setAfter(report.next_after!)}>다음 100개 전표</Button><Button onClick={()=>download(`ERP-LEDGER-${through}-${after}.csv`,erpCsv(report.ledger,['number','entry_date','note','account_code','party_id','cost_center_id','debit','credit']),'text/csv;charset=utf-8')}>원장 페이지 CSV</Button><Button onClick={()=>download(`ERP-REPORT-${through}-${after}.json`,JSON.stringify(report,null,2),'application/json')}>총계·현재 페이지 JSON</Button></Stack>{simpleTable(['전표','날짜','적요','계정','차변','대변'],report.ledger.map(l=>[l.number,l.entry_date,l.note,l.account_code,moneyLabel(l.debit),moneyLabel(l.credit)]))}</CardContent></Card>
    </>}
   </>}
   {tab===3&&<>
    <Box sx={grid}>
     <Card variant="outlined"><CardContent><Typography variant="h6">계정과목 추가</Typography><Stack spacing={2} sx={{mt:2}}><TextField label="계정 코드" value={accountCode} onChange={e=>setAccountCode(e.target.value)}/><TextField label="계정명" value={accountName} onChange={e=>setAccountName(e.target.value)}/><TextField select label="분류" value={accountKind} onChange={e=>setAccountKind(e.target.value)}>{Object.entries(kinds).map(([k,v])=><MenuItem key={k} value={k}>{v}</MenuItem>)}</TextField><FormControlLabel control={<Checkbox checked={requiresParty} onChange={e=>setRequiresParty(e.target.checked)}/>} label="전표에 거래처 필수"/><Button disabled={busy||!accountCode||accountName.trim().length<2} onClick={()=>void act('account_create',{code:accountCode,name:accountName,kind:accountKind,requires_party:requiresParty},'계정과목을 등록했습니다.')}>계정 등록</Button><Typography variant="caption">기존 계정의 분류는 변경하지 않습니다. 결제 계정 매핑은 결제·정산 메뉴에서 선택합니다.</Typography></Stack></CardContent></Card>
     <Card variant="outlined"><CardContent><Typography variant="h6">거래처 추가</Typography><Stack spacing={2} sx={{mt:2}}><TextField label="거래처 코드" value={partyCode} onChange={e=>setPartyCode(e.target.value)}/><TextField label="거래처명" value={partyName} onChange={e=>setPartyName(e.target.value)}/><TextField select label="유형" value={partyKind} onChange={e=>setPartyKind(e.target.value)}><MenuItem value="supplier">공급업체</MenuItem><MenuItem value="customer">고객</MenuItem><MenuItem value="other">기타</MenuItem></TextField><Button disabled={busy||!partyCode||partyName.trim().length<2} onClick={()=>void act('party_create',{code:partyCode,name:partyName,kind:partyKind},'거래처를 등록했습니다.')}>거래처 등록</Button><Typography variant="caption">정산 시설 운영사는 원천 전표 수신 시 자동 연결됩니다.</Typography></Stack></CardContent></Card>
     <Card variant="outlined"><CardContent><Typography variant="h6">시설·부문 추가</Typography><Stack spacing={2} sx={{mt:2}}><TextField label="시설·부문 코드" value={centerCode} onChange={e=>setCenterCode(e.target.value)}/><TextField label="명칭" value={centerName} onChange={e=>setCenterName(e.target.value)}/><Button disabled={busy||!centerCode||centerName.trim().length<2} onClick={()=>void act('cost_center_create',{code:centerCode,name:centerName},'보고서에 사용할 시설·부문을 등록했습니다.')}>시설·부문 등록</Button></Stack></CardContent></Card>
     <Card variant="outlined"><CardContent><Typography variant="h6">독립 시험 장부 추가</Typography><Stack spacing={2} sx={{mt:2}}><TextField label="장부 코드 · 영문 대문자·숫자" value={bookCode} onChange={e=>setBookCode(e.target.value)}/><TextField label="장부명" value={bookName} onChange={e=>setBookName(e.target.value)}/><Button disabled={busy||!bookCode||bookName.trim().length<2} onClick={()=>void act('book_create',{code:bookCode,name:bookName},'독립 시험 장부를 생성했습니다.').then(r=>{if(r)setBookId(String(r.id));})}>시험 장부 생성</Button><Typography variant="caption">법인별 실거래 장부와 기초잔액은 운영 정책 확정 후 별도로 인수합니다.</Typography></Stack></CardContent></Card>
    </Box>
    <Card variant="outlined" sx={{my:2}}><CardContent><Typography variant="h6">PG·지급대행 연동 계획</Typography><Alert severity="info" sx={{my:2}}>업체는 추후 지정할 수 있습니다. 아래 등록은 계획 정보만 저장하며 결제·송금을 활성화하지 않습니다. 비밀키나 계좌정보를 입력하지 마세요.</Alert>{simpleTable(['구분','업체','상태'],data.providers.map(p=>[p.kind==='payment'?'PG 결제':'지급대행',p.label??'추후 지정',p.status==='planned'?'계획 등록 · 미연결':'미지정']))}<Stack spacing={2} sx={{mt:2}}><TextField select label="연동 구분" value={providerKind} onChange={e=>setProviderKind(e.target.value)}><MenuItem value="payment">PG 결제</MenuItem><MenuItem value="payout">지급대행</MenuItem></TextField><TextField label="예정 업체 코드 · 영문 소문자·숫자" value={vendorCode} onChange={e=>setVendorCode(e.target.value)}/><TextField label="예정 업체명" value={vendorName} onChange={e=>setVendorName(e.target.value)}/><Stack direction="row" spacing={1}><Button disabled={busy||!vendorCode||vendorName.trim().length<2} onClick={()=>void act('provider_plan',{kind:providerKind,vendor_code:vendorCode,label:vendorName},'업체 계획을 저장했습니다. 연결은 아직 활성화되지 않습니다.')}>계획 저장</Button><Button disabled={busy} onClick={()=>void act('provider_plan',{kind:providerKind,vendor_code:'',label:''},'업체 미지정 상태로 변경했습니다.')}>추후 지정으로 변경</Button></Stack></Stack></CardContent></Card>
    <Card variant="outlined"><CardContent><Typography variant="h6">최근 변경 기록 · 최대 50건</Typography>{simpleTable(['시각','처리','참조'],data.audit.map(e=>[new Date(e.created_at).toLocaleString('ko-KR'),auditLabels[e.action]??e.action,e.object_id?.slice(0,8)??'—']))}</CardContent></Card>
   </>}
  </>}
 </Box>;
}

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { serviceRequestError } from '../lib/service-requests';
// Owner components are keyed by account + site. Late results never cross scopes.
export function useServiceRequestCommand(onComplete:()=>void){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const active=useRef(true),inFlight=useRef(false),request=useRef<{signature:string;id:string}|null>(null);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 async function run(action:string,payload:Record<string,unknown>):Promise<Record<string,unknown>|null>{
  if(inFlight.current)return null;inFlight.current=true;setBusy(true);setError('');
  const signature=JSON.stringify({action,payload});
  if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
  try{
   const {data,error}=await supabase.rpc('platform_service_request_command',{p_request_id:request.current.id,p_action:action,p_payload:payload});
   if(error)throw error;if(!active.current)return null;
   if(!data||typeof data!=='object'||typeof data.id!=='string')throw Error('invalid_membership_response');
   request.current=null;onComplete();return data;
  }catch(e){if(active.current)setError(serviceRequestError(e));return null;}
  finally{inFlight.current=false;if(active.current)setBusy(false);}
 }
 return {run,busy,error,clearError:()=>setError('')};
}

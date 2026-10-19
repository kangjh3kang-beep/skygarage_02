import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { governanceError } from '../../lib/governance';
// Key includes account, selected scope and refresh. An old response is never displayed
// as the current site after a scope change or failed refresh.
export function useGovernanceQuery<T>(rpc:string,args:Record<string,unknown>,key:string,parser:(data:unknown)=>T,enabled=true){
 const [response,setResponse]=useState<{key:string;data:T|null;error:string}|null>(null);
 const argsKey=JSON.stringify(args);
 useEffect(()=>{
  if(!enabled)return;
  let active=true;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  Promise.resolve(supabase.rpc(rpc,JSON.parse(argsKey)).abortSignal(controller.signal)).then(({data,error})=>{
   if(error)throw error;const parsed=parser(data);if(active)setResponse({key,data:parsed,error:''});
  }).catch(e=>{if(active)setResponse({key,data:null,error:governanceError(e)});}).finally(()=>clearTimeout(timeout));
  return()=>{active=false;clearTimeout(timeout);controller.abort();};
 },[rpc,argsKey,key,parser,enabled]);
 const current=enabled&&response?.key===key?response:null;
 return {data:current?.data??null,error:current?.error??'',loading:enabled&&!current};
}

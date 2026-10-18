-- Server-only signup operations. Run with the database owner, in one transaction.
begin;
alter table public.sgp_phone_verifications add column if not exists verified_at timestamptz;
alter table public.sgp_phone_verifications add column if not exists consumed_at timestamptz;

create or replace function public.sgp_confirm_phone(p_id uuid, p_code text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v public.sgp_phone_verifications%rowtype;
begin
  select * into v from public.sgp_phone_verifications where id = p_id for update;
  if not found then return jsonb_build_object('error', '인증 정보를 찾을 수 없습니다.'); end if;
  if v.verified or v.consumed_at is not null then return jsonb_build_object('error', '이미 사용한 인증입니다. 새 코드를 요청해주세요.'); end if;
  if v.attempts >= 5 then return jsonb_build_object('error', '시도 횟수를 초과했습니다. 새 코드를 요청해주세요.'); end if;
  if v.expires_at <= now() then return jsonb_build_object('error', '인증코드가 만료되었습니다. 재발송 해주세요.'); end if;
  update public.sgp_phone_verifications set attempts = attempts + 1 where id = p_id;
  if v.code <> p_code then return jsonb_build_object('error', '인증코드가 일치하지 않습니다.', 'remaining', 4 - v.attempts); end if;
  update public.sgp_phone_verifications set verified = true, verified_at = now() where id = p_id;
  return jsonb_build_object('verified', true, 'phone', v.phone);
end $$;

create or replace function public.sgp_claim_signup(p_id uuid, p_code text, p_phone text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v public.sgp_phone_verifications%rowtype;
begin
  update public.sgp_phone_verifications set consumed_at = now()
  where id = p_id and phone = p_phone and code = p_code and verified
    and verified_at > now() - interval '20 minutes' and consumed_at is null
  returning * into v;
  if not found then return jsonb_build_object('error', '문자 인증이 만료되었거나 이미 사용되었습니다. 다시 인증해주세요.'); end if;
  return jsonb_build_object('phone', v.phone, 'verified_at', v.verified_at);
end $$;

create or replace function public.sgp_finish_signup(p_user_id uuid, p_verification_id uuid, p_name text, p_birth text, p_gender text, p_address text, p_detail text)
returns void language plpgsql security invoker set search_path = '' as $$
declare v public.sgp_phone_verifications%rowtype;
begin
  select * into v from public.sgp_phone_verifications where id = p_verification_id and consumed_at is not null and verified_at is not null;
  if not found then raise exception 'Missing signup verification'; end if;
  if not exists(select 1 from auth.users where id = p_user_id and email = v.phone || '@sgp.skygarage.app') then
    raise exception 'Signup user does not match verification';
  end if;
  insert into public.sgp_users(id,phone,display_name,birth_date,gender_code,address,address_detail,kyc_level,is_verified,phone_verified_at)
  values(p_user_id,v.phone,p_name,p_birth,p_gender,p_address,p_detail,1,true,v.verified_at);
  insert into public.sgp_coin_wallets(user_id) values(p_user_id);
end $$;

-- These RPCs are callable only by the Edge Function's service role.
revoke all on function public.sgp_confirm_phone(uuid,text) from public, anon, authenticated;
revoke all on function public.sgp_claim_signup(uuid,text,text) from public, anon, authenticated;
revoke all on function public.sgp_finish_signup(uuid,uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.sgp_confirm_phone(uuid,text) to service_role;
grant execute on function public.sgp_claim_signup(uuid,text,text) to service_role;
grant execute on function public.sgp_finish_signup(uuid,uuid,text,text,text,text,text) to service_role;

-- OTPs and verified status remain server-managed. Wallet balances are read-only.
alter table public.sgp_users enable row level security;
alter table public.sgp_coin_wallets enable row level security;
alter table public.sgp_phone_verifications enable row level security;
revoke all on public.sgp_phone_verifications from anon, authenticated;
grant select on public.sgp_users, public.sgp_coin_wallets to authenticated;
drop policy if exists sgp_resident_read_self on public.sgp_users;
create policy sgp_resident_read_self on public.sgp_users for select to authenticated using ((select auth.uid()) = id);
drop policy if exists sgp_wallet_read_self on public.sgp_coin_wallets;
create policy sgp_wallet_read_self on public.sgp_coin_wallets for select to authenticated using ((select auth.uid()) = user_id);
commit;

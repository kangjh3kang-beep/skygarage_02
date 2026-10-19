-- Runs after the exact SQL implementation and catalog in a disposable local PG17 database.
begin;
create temporary table contract_results(label text primary key,passed boolean not null);
create function pg_temp.expect(p_label text,p_ok boolean) returns void language plpgsql as $$
begin if p_ok is distinct from true then raise exception 'FAILED: %',p_label; end if;insert into contract_results values(p_label,true);end $$;
create function pg_temp.as_user(p_actor uuid,p_aal text,p_query text) returns jsonb language plpgsql as $$
declare result jsonb;
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'aal',p_aal,'role',case when p_actor is null then 'anon' else 'authenticated' end,'user_metadata',jsonb_build_object('role','super_admin'))::text,true);
 if p_actor is null then execute 'set local role anon';else execute 'set local role authenticated';end if;
 begin execute p_query into result;
 exception when others then result:=jsonb_build_object('error',sqlerrm,'code',sqlstate);end;
 execute 'reset role';return result;
end $$;
do $$
declare admin uuid:=gen_random_uuid(); reviewer uuid:=gen_random_uuid(); manager uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); viewer uuid:=gen_random_uuid();
 org uuid; org2 uuid; site uuid; site2 uuid; scope uuid; scope2 uuid; req uuid:=gen_random_uuid(); evid uuid; failure uuid; retest uuid; issue uuid; result jsonb; snapshot jsonb; k text; p text; before_count integer;
begin
 insert into auth.users(id) values(admin),(reviewer),(manager),(outsider),(viewer);
 insert into public.user_roles(user_id,role) values(admin,'super_admin'),(reviewer,'manager'),(manager,'operator'),(outsider,'operator'),(viewer,'viewer');
 perform pg_temp.expect('anonymous RPC denied',(pg_temp.as_user(null,'aal2','select public.platform_governance_directory()')->>'code')='42501');
 perform pg_temp.expect('aal1 admin denied',(pg_temp.as_user(admin,'aal1','select public.platform_governance_directory()')->>'error')='mfa_required');
 perform pg_temp.expect('forged metadata is not HQ',(pg_temp.as_user(outsider,'aal2','select public.platform_governance_directory()')->>'headquarters')='false');
 result:=pg_temp.as_user(admin,'aal2',format('select to_jsonb(public.platform_create_organization(%L,%L))',req,'검증 조직 A'));org:=(result#>>'{}')::uuid;
 perform pg_temp.expect('organization idempotency',pg_temp.as_user(admin,'aal2',format('select to_jsonb(public.platform_create_organization(%L,%L))',req,'검증 조직 A'))=to_jsonb(org));
 perform pg_temp.expect('organization content conflict',pg_temp.as_user(admin,'aal2',format('select to_jsonb(public.platform_create_organization(%L,%L))',req,'다른 이름'))->>'error'='idempotency_conflict');
 org2:=(pg_temp.as_user(admin,'aal2',format('select to_jsonb(public.platform_create_organization(%L,%L))',gen_random_uuid(),'검증 조직 B'))#>>'{}')::uuid;
 req:=gen_random_uuid();
 site:=(pg_temp.as_user(admin,'aal2',format('select to_jsonb(public.platform_generate_site_v2(%L,%L,%L,%L,100,120))',req,org,'현장 A','apartment'))#>>'{}')::uuid;
 perform pg_temp.expect('site retry returns same identity',pg_temp.as_user(admin,'aal2',format('select to_jsonb(public.platform_generate_site_v2(%L,%L,%L,%L,100,120))',req,org,'현장 A','apartment'))=to_jsonb(site));
 perform pg_temp.expect('same request other organization denied',pg_temp.as_user(admin,'aal2',format('select to_jsonb(public.platform_generate_site_v2(%L,%L,%L,%L,100,120))',req,org2,'현장 A','apartment'))->>'error'='idempotency_conflict');
 perform pg_temp.expect('site and outbox atomic uniqueness',(select count(*)=1 from platform_private.provisioning_outbox where site_id=site));
 perform pg_temp.expect('configuration excludes actuation',(select definition->>'hardware_control_enabled'='false' from public.platform_site_blueprints where site_id=site));
 select count(*) into before_count from public.platform_sites;
 perform pg_temp.expect('invalid template rejected',pg_temp.as_user(admin,'aal2',format('select to_jsonb(public.platform_generate_site_v2(%L,%L,%L,%L,0,120))',gen_random_uuid(),org,'잘못된 현장','apartment'))->>'error'='invalid_template_input');
 perform pg_temp.expect('invalid template has no partial site',(select count(*)=before_count from public.platform_sites));
 site2:=(pg_temp.as_user(admin,'aal2',format('select to_jsonb(public.platform_generate_site_v2(%L,%L,%L,%L,100,120))',gen_random_uuid(),org2,'현장 B','mixed'))#>>'{}')::uuid;
 result:=pg_temp.as_user(admin,'aal2',format('select to_jsonb(public.platform_set_site_staff(%L,%L,%L,true,now()+interval ''30 days'',0))',site,manager,'manager'));
 perform pg_temp.expect('manager assignment versioned',result='1'::jsonb);
 perform pg_temp.as_user(admin,'aal2',format('select to_jsonb(public.platform_set_site_staff(%L,%L,%L,true,now()+interval ''30 days'',0))',site,reviewer,'reviewer'));
 perform pg_temp.as_user(admin,'aal2',format('select to_jsonb(public.platform_set_site_staff(%L,%L,%L,true,now()+interval ''30 days'',0))',site,viewer,'viewer'));
 perform pg_temp.expect('stale assignment conflict',pg_temp.as_user(admin,'aal2',format('select to_jsonb(public.platform_set_site_staff(%L,%L,%L,true,now()+interval ''30 days'',0))',site,manager,'manager'))->>'error'='version_conflict');
 result:=pg_temp.as_user(manager,'aal2','select public.platform_governance_directory()');
 perform pg_temp.expect('only assigned organization visible',jsonb_array_length(result->'organizations')=1 and jsonb_array_length(result->'sites')=1 and result->'sites'->0->>'id'=site::text);
 perform pg_temp.expect('non-HQ cannot list other operators',result->'operators'='[]'::jsonb and result->'assignments'='[]'::jsonb);
 perform pg_temp.expect('cross-site write denied',pg_temp.as_user(manager,'aal2',format('select to_jsonb(public.platform_open_validation_scope(%L,%L,%L))',gen_random_uuid(),site2,repeat('a',40)))->>'error'='site_access_denied');
 scope:=(pg_temp.as_user(manager,'aal2',format('select to_jsonb(public.platform_open_validation_scope(%L,%L,%L))',gen_random_uuid(),site,repeat('a',40)))#>>'{}')::uuid;
 perform pg_temp.expect('cross-site snapshot denied',pg_temp.as_user(outsider,'aal2',format('select public.platform_governance_snapshot(%L)',scope))->>'error'='site_access_denied');
 perform pg_temp.expect('direct private evidence table denied',pg_temp.as_user(manager,'aal2','select to_jsonb(count(*)) from platform_private.validation_evidence')->>'code'='42501');
 perform pg_temp.expect('direct worker denied',pg_temp.as_user(manager,'aal2','select platform_private.process_foundation_outbox()')->>'code'='42501');
 perform pg_temp.expect('read-only viewer cannot create scope',pg_temp.as_user(viewer,'aal2',format('select to_jsonb(public.platform_open_validation_scope(%L,%L,%L))',gen_random_uuid(),site,repeat('b',40)))->>'error'='site_access_denied');
 result:=pg_temp.as_user(admin,'aal2','select public.platform_process_foundation_queue()');
 perform pg_temp.expect('worker configures two site events',result->>'processed'='2');
 perform pg_temp.expect('exactly two allowed modules',(select count(*)=2 from platform_private.site_modules where site_id=site));
 perform pg_temp.expect('worker replay has no duplicate effects',pg_temp.as_user(admin,'aal2','select public.platform_process_foundation_queue()')->>'processed'='0');
 perform pg_temp.expect('no evidence means zero accepted',pg_temp.as_user(manager,'aal2',format('select public.platform_governance_snapshot(%L)',scope))->'readiness'->>'approved'='0');
 -- Immutable evidence; own approval cannot be used, including by HQ.
 req:=gen_random_uuid();
 p:=format('select to_jsonb(public.platform_submit_evidence(%L,%L,''F01'',''integration'',''staging'',''pass'',''proc-v1'',''https://example.org/test'',%L,''실제 시험 대조 결과'',now()-interval ''1 minute'',now()+interval ''30 days''))',scope,req,repeat('d',64));
 evid:=(pg_temp.as_user(manager,'aal2',p)#>>'{}')::uuid;
 perform pg_temp.expect('evidence replay stable',pg_temp.as_user(manager,'aal2',p)=to_jsonb(evid));
 perform pg_temp.expect('evidence altered replay rejected',pg_temp.as_user(manager,'aal2',replace(p,'실제 시험 대조 결과','내용이 변경된 시험 결과'))->>'error'='idempotency_conflict');
 perform pg_temp.expect('manager cannot review own evidence',pg_temp.as_user(manager,'aal2',format('select to_jsonb(public.platform_review_evidence(%L,''approved'',''독립 검수 결과 확인''))',evid))->>'code'='42501');
 perform pg_temp.expect('reviewer can independently approve',pg_temp.as_user(reviewer,'aal2',format('select to_jsonb(public.platform_review_evidence(%L,''approved'',''독립 검수 결과 확인''))',evid))->>'error' is null);
 perform pg_temp.expect('review cannot be overwritten',pg_temp.as_user(reviewer,'aal2',format('select to_jsonb(public.platform_review_evidence(%L,''rejected'',''다른 검수 결과 확인''))',evid))->>'error'='review_immutable');
 perform pg_temp.expect('one test never completes entire requirement',pg_temp.as_user(manager,'aal2',format('select public.platform_governance_snapshot(%L)',scope))->'readiness'->>'approved'='0');
 for k in select unnest(array['software','acceptance']) loop
  evid:=(pg_temp.as_user(manager,'aal2',format('select to_jsonb(public.platform_submit_evidence(%L,%L,''F01'',%L,''staging'',''pass'',''proc-v1'',''https://example.org/test'',%L,''전체 완료조건 대조'',now()-interval ''1 minute'',now()+interval ''30 days''))',scope,gen_random_uuid(),k,repeat('d',64)))#>>'{}')::uuid;
  perform pg_temp.as_user(reviewer,'aal2',format('select to_jsonb(public.platform_review_evidence(%L,''approved'',''전체 조건과 링크 해시 대조''))',evid));
 end loop;
 perform pg_temp.expect('all kinds plus independent review complete F01',pg_temp.as_user(manager,'aal2',format('select public.platform_governance_snapshot(%L)',scope))->'readiness'->>'approved'='1');
 evid:=(pg_temp.as_user(admin,'aal2',format('select to_jsonb(public.platform_submit_evidence(%L,%L,''F05'',''software'',''staging'',''pass'',''proc-v1'',''https://example.org/test'',%L,''최고관리자 자기검수 거부 시험'',now(),now()+interval ''30 days''))',scope,gen_random_uuid(),repeat('d',64)))#>>'{}')::uuid;
 perform pg_temp.expect('HQ cannot approve its own evidence',pg_temp.as_user(admin,'aal2',format('select to_jsonb(public.platform_review_evidence(%L,''approved'',''자기 승인 경로 검사 시험''))',evid))->>'error'='independent_reviewer_required');
 for k in select unnest(array['integration','acceptance']) loop
  evid:=(pg_temp.as_user(manager,'aal2',format('select to_jsonb(public.platform_submit_evidence(%L,%L,''T02'',%L,''staging'',''pass'',''proc-v1'',''https://example.org/test'',%L,''선행 조건 분리 확인 시험'',now(),now()+interval ''30 days''))',scope,gen_random_uuid(),k,repeat('d',64)))#>>'{}')::uuid;
  perform pg_temp.as_user(reviewer,'aal2',format('select to_jsonb(public.platform_review_evidence(%L,''approved'',''해당 시험만 독립 검수''))',evid));
 end loop;
 snapshot:=pg_temp.as_user(manager,'aal2',format('select public.platform_governance_snapshot(%L)',scope));
 perform pg_temp.expect('missing dependency blocks otherwise complete requirement',snapshot->'readiness'->>'covered'='2' and snapshot->'readiness'->>'approved'='1');
 update platform_private.validation_evidence set expires_at=now()-interval '10 seconds' where scope_id=scope and requirement_id='F01' and test_kind='software';
 perform pg_temp.expect('expired evidence removes acceptance',pg_temp.as_user(manager,'aal2',format('select public.platform_governance_snapshot(%L)',scope))->'readiness'->>'approved'='0');
 update platform_private.validation_evidence set expires_at=now()+interval '30 days' where scope_id=scope and requirement_id='F01';
 perform pg_temp.expect('simulation cannot claim field evidence',pg_temp.as_user(manager,'aal2',format('select to_jsonb(public.platform_submit_evidence(%L,%L,''R01'',''sat'',''simulation'',''pass'',''proc-v1'',''https://example.org/test'',%L,''모의 결과를 현장으로 오인 금지'',now(),now()+interval ''30 days''))',scope,gen_random_uuid(),repeat('d',64)))->>'code'='23514');
 perform pg_temp.expect('signed temporary URL rejected',pg_temp.as_user(manager,'aal2',format('select to_jsonb(public.platform_submit_evidence(%L,%L,''F01'',''integration'',''staging'',''pass'',''proc-v1'',''https://example.org/test?secret=foo'',%L,''임시키가 포함된 링크 거부'',now(),now()+interval ''30 days''))',scope,gen_random_uuid(),repeat('d',64)))->>'code'='23514');
 perform pg_temp.expect('expired evidence submission rejected',pg_temp.as_user(manager,'aal2',format('select to_jsonb(public.platform_submit_evidence(%L,%L,''F01'',''integration'',''staging'',''pass'',''proc-v1'',''https://example.org/test'',%L,''만료된 증거 제출 금지'',now()-interval ''2 days'',now()-interval ''1 day''))',scope,gen_random_uuid(),repeat('d',64)))->>'error'='invalid_evidence_time');
 failure:=(pg_temp.as_user(manager,'aal2',format('select to_jsonb(public.platform_submit_evidence(%L,%L,''F01'',''integration'',''staging'',''fail'',''proc-v2'',''https://example.org/fail'',%L,''재시험 실패 확인 결과'',now()-interval ''30 seconds'',now()+interval ''30 days''))',scope,gen_random_uuid(),repeat('e',64)))#>>'{}')::uuid;
 select id into issue from platform_private.improvement_items where source_evidence_id=failure;
 perform pg_temp.expect('failure automatically creates defect',issue is not null);
 snapshot:=pg_temp.as_user(manager,'aal2',format('select public.platform_governance_snapshot(%L)',scope));
 perform pg_temp.expect('new failure invalidates previous acceptance',snapshot->'readiness'->>'approved'='0' and snapshot->'readiness'->>'blocking_defects'='1');
 perform pg_temp.expect('failure cannot be approved',pg_temp.as_user(reviewer,'aal2',format('select to_jsonb(public.platform_review_evidence(%L,''approved'',''통과로 바꾸기 시도 차단''))',failure))->>'error'='passing_current_evidence_required');
 perform pg_temp.as_user(manager,'aal2',format('select to_jsonb(public.platform_transition_improvement(%L,1,''in_progress''))',issue));
 perform pg_temp.expect('task concurrent stale update rejected',pg_temp.as_user(manager,'aal2',format('select to_jsonb(public.platform_transition_improvement(%L,1,''verification'',%L))',issue,evid))->>'error'='version_conflict');
 perform pg_temp.expect('old evidence cannot close new defect',pg_temp.as_user(manager,'aal2',format('select to_jsonb(public.platform_transition_improvement(%L,2,''verification'',%L))',issue,evid))->>'error'='new_passing_evidence_required');
 retest:=(pg_temp.as_user(manager,'aal2',format('select to_jsonb(public.platform_submit_evidence(%L,%L,''F01'',''integration'',''staging'',''pass'',''proc-v3'',''https://example.org/retest'',%L,''수정 후 재시험 통과 확인'',now(),now()+interval ''30 days''))',scope,gen_random_uuid(),repeat('f',64)))#>>'{}')::uuid;
 perform pg_temp.as_user(manager,'aal2',format('select to_jsonb(public.platform_transition_improvement(%L,2,''verification'',%L))',issue,retest));
 perform pg_temp.expect('unreviewed retest cannot close defect',pg_temp.as_user(reviewer,'aal2',format('select to_jsonb(public.platform_transition_improvement(%L,3,''closed''))',issue))->>'error'='reviewed_retest_required');
 perform pg_temp.as_user(reviewer,'aal2',format('select to_jsonb(public.platform_review_evidence(%L,''approved'',''재시험 증거와 실패 원인 대조''))',retest));
 perform pg_temp.expect('submitter cannot self-close',pg_temp.as_user(manager,'aal2',format('select to_jsonb(public.platform_transition_improvement(%L,3,''closed''))',issue))->>'code'='42501');
 perform pg_temp.expect('reviewer closes verified defect',pg_temp.as_user(reviewer,'aal2',format('select to_jsonb(public.platform_transition_improvement(%L,3,''closed''))',issue))='4'::jsonb);
 perform pg_temp.expect('feedback loop restores valid acceptance',pg_temp.as_user(manager,'aal2',format('select public.platform_governance_snapshot(%L)',scope))->'readiness'->>'approved'='1');
 -- Expired reviewer rights invalidate their sign-offs without deleting evidence.
 update platform_private.site_staff set valid_until=now()-interval '1 minute' where site_id=site and user_id=reviewer;
 perform pg_temp.expect('reviewer expiry invalidates approvals',pg_temp.as_user(manager,'aal2',format('select public.platform_governance_snapshot(%L)',scope))->'readiness'->>'approved'='0');
 update platform_private.site_staff set valid_until=now()+interval '30 days' where site_id=site and user_id=reviewer;
 perform pg_temp.expect('no shortcuts to site acceptance',pg_temp.as_user(admin,'aal2',format('select to_jsonb(public.platform_set_site_phase(%L,%L,''sandbox'',''site_acceptance'',''실제 현장 인수 시작 요청''))',site,scope))->>'error'='foundation_gates_missing');
 scope2:=(pg_temp.as_user(manager,'aal2',format('select to_jsonb(public.platform_open_validation_scope(%L,%L,%L))',gen_random_uuid(),site,repeat('b',40)))#>>'{}')::uuid;
 perform pg_temp.expect('new release cannot copy old approvals',pg_temp.as_user(manager,'aal2',format('select public.platform_governance_snapshot(%L)',scope2))->'readiness'->>'approved'='0');
 perform pg_temp.as_user(admin,'aal2',format('select to_jsonb(public.platform_set_site_staff(%L,%L,''manager'',false,now()+interval ''30 days'',1))',site,manager));
 perform pg_temp.expect('revocation immediately denies snapshot',pg_temp.as_user(manager,'aal2',format('select public.platform_governance_snapshot(%L)',scope))->>'error'='site_access_denied');
 perform pg_temp.expect('revocation immediately hides directory',pg_temp.as_user(manager,'aal2','select public.platform_governance_directory()')->'sites'='[]'::jsonb);
 -- Worker errors retry with bounded backoff, and never leave partial inbox/module writes.
 update platform_private.provisioning_outbox set payload_digest='incorrect',status='pending',attempts=0,available_at=now() where site_id=site2;
 delete from platform_private.site_modules where site_id=site2;
 delete from platform_private.provisioning_inbox where event_id in(select id from platform_private.provisioning_outbox where site_id=site2);
 for before_count in 1..5 loop
  perform platform_private.process_foundation_outbox(20);
  update platform_private.provisioning_outbox set available_at=now() where site_id=site2;
 end loop;
 perform pg_temp.expect('five failures go to dead letter',(select status='dead_letter' and attempts=5 from platform_private.provisioning_outbox where site_id=site2));
 perform pg_temp.expect('failed consumer has no partial effects',not exists(select 1 from platform_private.site_modules where site_id=site2));
 -- Explicit fixture seeding is confined to this local transaction; no real site approval.
 update public.platform_sites set phase='ready' where id=site;
 perform platform_private.governance_maintenance_tick();
 perform pg_temp.expect('maintenance suspends invalid ready site',(select phase='suspended' from public.platform_sites where id=site));
 perform pg_temp.expect('automatic suspension audited',exists(select 1 from platform_private.audit_events where subject_id=site and action='site.gates_expired'));
 perform pg_temp.expect('fixed denominator remains 36',(select count(*)=36 from platform_private.requirement_catalog));
 perform pg_temp.expect('all new private tables protected',not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='platform_private' and c.relkind='r' and not c.relrowsecurity));
end $$;
select jsonb_build_object('passed',count(*),'checks',jsonb_agg(label order by label)) as report from contract_results;
rollback;

-- Read-only role regression. Claims exist only inside this rolled-back transaction.
-- Never returns user identifiers or reads user profile contents.
begin;
do $$
declare admin_id uuid; report jsonb:='[]'::jsonb; snapshot jsonb; denied boolean;
begin
 select user_id into admin_id from public.user_roles where role='super_admin' limit 1;
 if admin_id is null then raise exception 'test_requires_existing_super_admin'; end if;
 perform set_config('request.jwt.claims','{}',true);
 execute 'set local role anon';
 denied:=false;
 begin perform public.platform_readiness_snapshot(); exception when insufficient_privilege then denied:=true; end;
 execute 'reset role';
 if not denied then raise exception 'anonymous_was_allowed'; end if;
 report:=report||jsonb_build_array('anonymous_denied');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'aal','aal2','role','authenticated','user_metadata',jsonb_build_object('role','super_admin'))::text,true);
 execute 'set local role authenticated';
 denied:=false;
 begin perform public.platform_readiness_snapshot(); exception when insufficient_privilege then denied:=true; end;
 execute 'reset role';
 if not denied then raise exception 'forged_role_was_allowed'; end if;
 report:=report||jsonb_build_array('forged_metadata_role_denied');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'aal','aal1','role','authenticated')::text,true);
 execute 'set local role authenticated';
 denied:=false;
 begin perform public.platform_readiness_snapshot(); exception when insufficient_privilege then denied:=true; end;
 execute 'reset role';
 if not denied then raise exception 'aal1_was_allowed'; end if;
 report:=report||jsonb_build_array('super_admin_aal1_denied');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'aal','aal2','role','authenticated')::text,true);
 execute 'set local role authenticated';
 snapshot:=public.platform_readiness_snapshot();
 execute 'reset role';
 if snapshot->>'schema_version'<>'1' or snapshot->'counts'->>'devices' is null then raise exception 'snapshot_contract_failed'; end if;
 if (snapshot->'counts'->>'devices')::bigint<>(select count(*) from public.hardware_device_registry) then raise exception 'count_mismatch'; end if;
 if (select count(*) from jsonb_object_keys(snapshot))<>4 then raise exception 'unexpected_response_fields'; end if;
 if snapshot::text ~ 'email|phone|secret|token|plate|user_id' then raise exception 'sensitive_key_found'; end if;
 report:=report||jsonb_build_array('super_admin_aal2_allowed','device_count_matches','aggregate_only_response');
 perform set_config('doelv.readiness_tests',report::text,true);
end $$;
select current_setting('doelv.readiness_tests')::jsonb as passed;
rollback;

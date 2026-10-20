import { createClient } from '@supabase/supabase-js';
import { exerciseLiveAuth } from './runner.ts';

const allowedOrigins = new Set(['https://www.skygarage.net', 'https://skygarage.net']);
Deno.serve(async (request: Request) => {
  const origin = request.headers.get('Origin') ?? '';
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://www.skygarage.net',
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
  const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (!allowedOrigins.has(origin)) return response({ code: 'origin_denied' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return response({ code: 'method_not_allowed' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return response({ code: 'authentication_required' }, 401);
  try {
    const body = await request.json();
    if (!body || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.request_id) || !/^[a-f0-9]{40}$/.test(body.release_sha)) return response({ code: 'invalid_test_request' }, 400);
    const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!url || !anon || !service) return response({ code: 'server_not_configured' }, 503);
    const make = (key: string, auth?: string) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { ...(auth ? { headers: { Authorization: auth } } : {}), fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) } });
    const headquarters = make(anon, authorization);
    const user = await headquarters.auth.getUser(authorization.slice(7));
    if (user.error || !user.data.user) return response({ code: 'authentication_required' }, 401);
    // PostgREST verifies the real JWT and live DB role, including aal2, again.
    const begun = await headquarters.rpc('platform_begin_live_auth_test', { p_request_id: body.request_id, p_release_sha: body.release_sha });
    if (begun.error) return response({ code: begun.error.code === '42501' ? 'headquarters_mfa_required' : begun.error.message === 'rate_limited' ? 'rate_limited' : 'test_cannot_start' }, begun.error.code === '42501' ? 403 : 409);
    if (!begun.data.claimed) return response(begun.data);
    const report = await exerciseLiveAuth({ run: begun.data, headquarters, admin: make(service), newClient: () => make(anon) });
    return response(report);
  } catch { return response({ code: 'test_execution_unconfirmed', retry: 'query_report_before_retry' }, 500); }
});

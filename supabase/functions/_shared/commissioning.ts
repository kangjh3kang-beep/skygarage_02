/** Legacy routes stay unavailable until reviewed replacements pass commissioning.
 * This handler has no database, secret, vendor-network or actuator access.
 */
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization,Apikey,X-Client-Info,X-Adapter-Key,X-Device-Serial', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
export function commissioningResponse(request: Request): Response {
 if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
 const path = new URL(request.url).pathname;
 if (request.method === 'GET' && path.endsWith('/health')) return new Response(JSON.stringify({ mode: 'commissioning', operational: false, hardware_control_enabled: false }), { headers });
 return new Response(JSON.stringify({ code: 'commissioning_required', error: '운영 검증이 완료되지 않은 기능입니다.', operational: false, hardware_control_enabled: false }), { status: 503, headers });
}

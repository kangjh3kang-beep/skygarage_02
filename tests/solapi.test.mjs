import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createAuthorization, sendSolapi, generateCode, checkSolapiAuthentication } from '../supabase/functions/sms-verify/solapi.ts';
const config = { apiKey: 'test-key', apiSecret: 'test-secret', sender: '0212345678' };
const phone = '01000000000';
const body = 'TEST';
const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status });

test('HMAC header agrees with Node crypto using fixed date and salt', async () => {
  const date = '2026-10-18T02:00:00Z', salt = 'abcdefghijklmnop';
  const expected = createHmac('sha256', config.apiSecret).update(date + salt).digest('hex');
  assert.equal(await createAuthorization(config, date, salt), `HMAC-SHA256 apiKey=test-key, date=${date}, salt=${salt}, signature=${expected}`);
});
test('uses documented endpoint and accepts one registered message', async () => {
  const result = await sendSolapi(config, phone, body, async (url, init) => {
    assert.equal(url, 'https://api.solapi.com/messages/v4/send-many/detail');
    const request = JSON.parse(init.body);
    assert.deepEqual(request.messages, [{ to: phone, from: config.sender, text: body, type: 'SMS' }]);
    assert.equal(request.showMessageList, true);
    assert.ok(init.signal);
    return json({ groupInfo: { count: { registeredSuccess: 1, registeredFailed: 0 } }, messageList: [{ statusCode: '2000', messageId: 'M-test' }] });
  });
  assert.deepEqual(result, { success: true, messageId: 'M-test', provider: 'solapi' });
});
test('HTTP 200 with rejected sender remains a failure', async () => {
  const result = await sendSolapi(config, phone, body, async () => json({ groupInfo: { count: { registeredSuccess: 0, registeredFailed: 1 } }, failedMessageList: [{ statusCode: '3040' }] }));
  assert.equal(result.success, false);
  assert.match(result.error, /발신번호/);
});
test('missing credentials and invalid receiver never make a provider request', async () => {
  const forbidden = () => { throw Error('must not call'); };
  assert.equal((await sendSolapi({ ...config, apiKey: '' }, phone, body, forbidden)).success, false);
  assert.equal((await sendSolapi(config, 'bad', body, forbidden)).success, false);
});
test('malformed success and partial registration cannot report success', async () => {
  for (const payload of [{}, { groupInfo: { groupId: 'G-test' } }, { groupInfo: { count: { registeredSuccess: 1, registeredFailed: 1 } }, messageList: [{ statusCode: '2000', messageId: 'M-test' }] }]) {
    assert.equal((await sendSolapi(config, phone, body, async () => json(payload))).success, false);
  }
});
test('provider authentication error is sanitized', async () => {
  const result = await sendSolapi(config, phone, body, async () => json({ errorMessage: 'sensitive-provider-details' }, 403));
  assert.equal(result.success, false);
  assert.ok(!JSON.stringify(result).includes('sensitive-provider-details'));
});
test('network failure does not retry or accidentally return success', async () => {
  let calls = 0;
  const result = await sendSolapi(config, phone, body, async () => { calls++; throw Error('timeout'); });
  assert.equal(calls, 1);
  assert.equal(result.success, false);
});
test('cryptographic OTP preserves exactly six digits including leading zeros', () => {
  for (let i = 0; i < 100; i++) assert.match(generateCode(), /^\d{6}$/);
});

test('read-only authentication probe returns only boolean and makes no SMS call', async () => {
  assert.equal(await checkSolapiAuthentication(config, async (url) => {
    assert.equal(url, 'https://api.solapi.com/cash/v1/balance');
    return json({ balance: 1, accountId: 'private' });
  }), true);
  assert.equal(await checkSolapiAuthentication(config, async () => json({ errorCode: 'InvalidAPIKey' }, 403)), false);
});

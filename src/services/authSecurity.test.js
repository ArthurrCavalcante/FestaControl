import test from 'node:test';
import assert from 'node:assert/strict';

test('captcha options are only sent after a challenge succeeds', async () => {
  const module = await import('./authSecurity.js').catch(() => ({}));
  assert.equal(typeof module.withCaptchaToken, 'function');
  assert.deepEqual(module.withCaptchaToken('token-123'), { captchaToken: 'token-123' });
  assert.deepEqual(module.withCaptchaToken(''), {});
  assert.deepEqual(module.withCaptchaToken(undefined), {});
});

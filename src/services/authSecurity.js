export function withCaptchaToken(token) {
  return typeof token === 'string' && token.trim() ? { captchaToken: token } : {};
}

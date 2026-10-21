import { randomBytes } from 'node:crypto';
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const bytes = randomBytes(20);
let value = 0, bits = 0, secret = '';
for (const byte of bytes) {
  value = (value << 8) | byte; bits += 8;
  while (bits >= 5) { bits -= 5; secret += alphabet[(value >>> bits) & 31]; }
}
console.log('Store this secret in your authenticator and ANALYTICS_OWNER_TOTP_SECRET. Keep it private.\n' + secret);
console.log('Authenticator setup URI (SHA1, 6 digits, 30 seconds):\n' + `otpauth://totp/Veloce:owner?secret=${secret}&issuer=Veloce&algorithm=SHA1&digits=6&period=30`);

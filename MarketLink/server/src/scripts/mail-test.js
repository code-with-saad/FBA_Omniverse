/**
 * Sends a test e-mail with the settings from server/.env.
 *   npm run mail:test -- you@example.com
 */
import env from '../config/env.js';
import { deliverMail, mailErrorHint, mailMode, verifyMail } from '../services/mailer.js';

const to = process.argv[2] || env.smtp.user;
if (!to || !to.includes('@')) {
  console.error('Usage: npm run mail:test -- you@example.com');
  process.exit(1);
}

const mode = mailMode();
console.log(`Mail mode: ${mode}${mode === 'smtp' ? ` (${env.smtp.service || `${env.smtp.host}:${env.smtp.port}`}, from ${env.smtp.from})` : ''}`);
const check = await verifyMail();
if (!check.ok) process.exit(1);

try {
  const info = await deliverMail({
    to,
    subject: 'Test e-mail',
    message: 'Your MarketLink e-mail settings work.\nOrder confirmations, ready-for-pickup notices and password reset links will arrive like this one.',
    link: '/',
    linkLabel: 'Open MarketLink',
  });
  console.log(`Test e-mail ${mode === 'console' ? 'printed above (console mode)' : `sent to ${to}`}. Message id: ${info.messageId || 'n/a'}`);
  process.exit(0);
} catch (err) {
  console.error(`Sending failed: ${err.message}\n${mailErrorHint(err)}`);
  process.exit(1);
}

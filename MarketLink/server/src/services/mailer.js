import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import env from '../config/env.js';

/**
 * E-mail delivery with Nodemailer. Three modes (set in server/.env):
 *  - smtp     SMTP_HOST=smtp.gmail.com (or SMTP_SERVICE=gmail) + SMTP_USER + SMTP_PASS -> e-mails are really sent
 *  - ethereal SMTP_HOST=ethereal                               -> free test inbox; a link to view each e-mail is printed
 *  - console  SMTP_HOST empty (default)                        -> the e-mail is printed in the server console
 */
export function mailMode() {
  const { host, service } = env.smtp;
  if (!host && !service) return 'console';
  return host.toLowerCase() === 'ethereal' ? 'ethereal' : 'smtp';
}

const LOGO_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'mail-logo.png');
const HAS_LOGO = fs.existsSync(LOGO_PATH);

function smtpTransport() {
  const { host, service, port, secure, user, pass } = env.smtp;
  return nodemailer.createTransport({
    ...(service ? { service } : { host, port, secure }),
    auth: user ? { user, pass } : undefined,
    // Fail fast instead of hanging a request when the mail server cannot be reached
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

let transporterPromise;
function getTransporter() {
  if (!transporterPromise) {
    const mode = mailMode();
    if (mode === 'smtp') {
      transporterPromise = Promise.resolve(smtpTransport());
    } else if (mode === 'ethereal') {
      transporterPromise = nodemailer.createTestAccount().then((account) => {
        console.log(`[mail] Ethereal test inbox ready: ${account.user} (password ${account.pass}) - log in at https://ethereal.email`);
        return nodemailer.createTransport({ host: account.smtp.host, port: account.smtp.port, secure: account.smtp.secure, auth: { user: account.user, pass: account.pass } });
      });
      transporterPromise.catch(() => {
        transporterPromise = undefined; // try again next time (e.g. no internet right now)
      });
    } else {
      transporterPromise = Promise.resolve(nodemailer.createTransport({ jsonTransport: true }));
    }
  }
  return transporterPromise;
}

/** Explains the most common SMTP problems in plain words. */
export function mailErrorHint(err) {
  const code = err?.code || '';
  const text = `${err?.message || ''} ${err?.response || ''}`;
  if (code === 'EAUTH' || /535|534|Username and Password not accepted|Invalid login/i.test(text)) {
    return 'The mail server rejected the login. Check SMTP_USER and SMTP_PASS. For Gmail, turn on 2-Step Verification and use a 16-character App Password (your normal Gmail password does not work).';
  }
  if (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNREFUSED', 'EDNS', 'ENOTFOUND'].includes(code)) {
    return `Could not reach ${env.smtp.service || `${env.smtp.host}:${env.smtp.port}`}. Check SMTP_HOST and SMTP_PORT (587 = STARTTLS, 465 = SSL) and that your network allows outgoing SMTP.`;
  }
  if (code === 'EENVELOPE') return 'The sender or recipient address was refused. Check MAIL_FROM (Gmail only sends from your own address).';
  return 'Check the SMTP_* settings in server/.env.';
}

/**
 * Checks the mail settings once at start-up and prints the result, so a wrong
 * password shows up immediately instead of when the first order is placed.
 */
export async function verifyMail() {
  const mode = mailMode();
  if (mode === 'console') {
    if (env.smtp.missingHost) {
      console.warn(`[mail] SMTP_USER and SMTP_PASS are set, but SMTP_HOST is empty and the server for "${env.smtp.user.split('@')[1]}" is not known.\n       Set SMTP_HOST (and SMTP_PORT) in server/.env. Until then e-mails are printed here.`);
    } else {
      console.log('[mail] Console mode: e-mails are printed here. Set SMTP_* in server/.env to send real e-mails.');
    }
    return { ok: true, mode };
  }
  if (env.smtp.autoHost) console.log(`[mail] SMTP_HOST is empty, so ${env.smtp.host}:${env.smtp.port} is used for ${env.smtp.user}.`);
  try {
    const transporter = await getTransporter();
    await transporter.verify();
    const where = mode === 'ethereal' ? 'Ethereal test inbox' : env.smtp.service || `${env.smtp.host}:${env.smtp.port}${env.smtp.secure ? ' (SSL)' : ''}`;
    console.log(`[mail] SMTP ready: e-mails are sent through ${where}${env.smtp.user ? ` as ${env.smtp.user}` : ''}`);
    return { ok: true, mode };
  } catch (err) {
    console.error(`[mail] SMTP check failed: ${err.message}\n       ${mailErrorHint(err)}`);
    return { ok: false, mode, error: err.message, hint: mailErrorHint(err) };
  }
}

const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Absolute link for an e-mail button ("/account/orders/1" -> "https://site/account/orders/1"). */
const absoluteUrl = (link) => (!link ? '' : /^https?:\/\//.test(link) ? link : `${env.appUrl}${link.startsWith('/') ? '' : '/'}${link}`);

function layout({ title, message, button, footer }) {
  const paragraphs = escapeHtml(message)
    .split(/\n{2,}|\n/)
    .map((line) =>
      line.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
        const label = /google\.[a-z.]+\/maps/.test(url) ? 'Open in Google Maps' : url;
        return `<a href="${url}" style="color:#2e7d4f;font-weight:bold;word-break:break-all">${label}</a>`;
      })
    )
    .map((line) => `<p style="margin:0 0 12px">${line}</p>`)
    .join('');
  const header = HAS_LOGO
    ? '<img src="cid:marketlink-logo" alt="MarketLink" width="180" height="42" style="display:block;border:0;height:42px;width:180px">'
    : '<span style="font-size:22px;font-weight:bold;color:#ffffff">Market<i style="color:#d4f06e">Link</i></span>';
  const cta = button
    ? `<p style="margin:22px 0 6px"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#2e7d4f;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:999px">${escapeHtml(button.label)}</a></p>`
    : '';
  return `<!doctype html>
<html><body style="margin:0;background:#f5f1e6">
  <span style="display:none;max-height:0;overflow:hidden">${escapeHtml(message.split('\n')[0])}</span>
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f5f1e6;padding:24px 12px">
    <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e7e1d3">
      <div style="background:#173b2c;padding:18px 24px">${header}</div>
      <div style="padding:26px 24px 20px;color:#16211c;font-size:15px;line-height:1.6">
        <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#173b2c">${escapeHtml(title)}</h1>
        ${paragraphs}
        ${cta}
      </div>
      <div style="padding:14px 24px;background:#f1ebdd;color:#66756d;font-size:12px;line-height:1.5">
        Fresh from local farmers markets &middot; Pre-order, pick up, pay in person.<br>
        ${footer || 'You are receiving this e-mail because you have a MarketLink account.'}
      </div>
    </div>
  </div>
</body></html>`;
}

/**
 * Sends one e-mail and throws if it fails (used by the test command).
 * @param {{to: string, subject: string, message: string, link?: string, linkLabel?: string}} mail
 */
export async function deliverMail({ to, subject, message, link, linkLabel = 'Open MarketLink', footerHtml, footerText, headers }) {
  const url = absoluteUrl(link);
  const button = url ? { url, label: linkLabel } : null;
  const text = `${url ? `${message}\n\n${linkLabel}: ${url}` : message}${footerText ? `\n\n${footerText}` : ''}`;
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: env.smtp.from,
    to,
    subject: `MarketLink: ${subject}`,
    text,
    html: layout({ title: subject, message, button, footer: footerHtml }),
    headers,
    attachments: HAS_LOGO ? [{ filename: 'marketlink-logo.png', path: LOGO_PATH, cid: 'marketlink-logo' }] : [],
  });
  const mode = mailMode();
  if (mode === 'ethereal') console.log(`[mail] To: ${to} | ${subject} | view: ${nodemailer.getTestMessageUrl(info)}`);
  if (mode === 'smtp' && env.nodeEnv !== 'test') console.log(`[mail] Sent to ${to} | ${subject}`);
  if (mode === 'console' && env.nodeEnv !== 'test') {
    console.log(`[mail] (console mode) To: ${to} | Subject: ${subject}\n       ${text.replace(/\n/g, '\n       ')}`);
  }
  return info;
}

/** Sends an e-mail. Never throws: a failed e-mail must not break the order flow. */
export async function sendMail(mail) {
  if (!mail?.to) return undefined;
  try {
    return await deliverMail(mail);
  } catch (err) {
    console.error(`[mail] Failed to send "${mail.subject}" to ${mail.to}: ${err.message}\n       ${mailErrorHint(err)}`);
    return undefined;
  }
}

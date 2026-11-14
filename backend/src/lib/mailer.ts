import nodemailer from 'nodemailer';

const from = process.env.MAIL_FROM || 'no-reply@thniyti.local';

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    console.info(`[mail-dev] to=${to} subject=${subject} body=${text}`);
    return;
  }
  await transport.sendMail({ from, to, subject, text });
}

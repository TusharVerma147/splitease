import nodemailer from 'nodemailer';
import { config } from '../../config/configuration';
import { logger } from '../../logger/logger';

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: false,
  ignoreTLS: true,
});

/** Sends via the local Mailpit SMTP server. Failures are logged, never thrown. */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await transporter.sendMail({ from: config.SMTP_FROM, to, subject, html });
    logger.debug('Email sent', { to, subject });
  } catch (err) {
    logger.error('Failed to send email', { to, subject, err });
  }
}

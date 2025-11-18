import nodemailer from "nodemailer";
import { env } from "../config/env";

const transporter =
  process.env.NODE_ENV === "test"
    ? nodemailer.createTransport({ jsonTransport: true })
    : nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });

type PasswordResetEmailParams = {
  to: string;
  name: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail({ to, name, resetUrl }: PasswordResetEmailParams) {
  await transporter.sendMail({
    from: `"Suporte AXIS" <${env.SMTP_FROM}>`,
    to,
    subject: "Redefinição de senha",
    html: `
      <p>Olá, ${name}!</p>
      <p>Recebemos uma solicitação para redefinir sua senha.</p>
      <p>Clique no link abaixo para criar uma nova senha (válido por 15 minutos):</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Se você não fez essa solicitação, ignore este e-mail.</p>
    `,
  });
}

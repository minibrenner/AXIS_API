"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
const transporter = process.env.NODE_ENV === "test"
    ? nodemailer_1.default.createTransport({ jsonTransport: true })
    : nodemailer_1.default.createTransport({
        host: env_1.env.SMTP_HOST,
        port: env_1.env.SMTP_PORT,
        secure: env_1.env.SMTP_SECURE,
        auth: {
            user: env_1.env.SMTP_USER,
            pass: env_1.env.SMTP_PASS,
        },
    });
async function sendPasswordResetEmail({ to, name, resetUrl }) {
    await transporter.sendMail({
        from: `"Suporte AXIS" <${env_1.env.SMTP_FROM}>`,
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
//# sourceMappingURL=mailer.js.map
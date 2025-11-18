import crypto from "node:crypto";

/**
 * Gera um par de valores para reset de senha.
 * rawToken é enviado ao usuário via link seguro; tokenHash fica persistido.
 */
export function generateResetToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
}

/**
 * Converte um token recebido do cliente para hash comparável.
 */
export function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

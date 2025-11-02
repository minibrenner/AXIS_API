import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

// Este modulo centraliza a criacao e validacao dos tokens JWT usados na autenticacao.

/**
 * Estrutura padrao das informacoes (claims) que inserimos dentro do JWT.
 */
export type JWTPayload = {
  /**
   * Identificador do usuario autenticado (subject).
   */
  sub: string;
  /**
   * Identificador do tenant (cliente/empresa) ao qual o usuario pertence.
   */
  tid: string;
  /**
   * Papel do usuario para validar permissoes posteriormente (admin, viewer, etc).
   */
  role: string;
  /**
   * Campo tecnico que diferencia tokens de acesso dos tokens de refresh.
   */
  type: 'access' | 'refresh';
};

/**
 * Assina um token de acesso (curta duracao) com o segredo definido em JWT_ACCESS_SECRET.
 *
 * @param payload Dados do usuario que serao embedados no token.
 */
export function signAccess(payload: Omit<JWTPayload, 'type'>) {
  const expiresIn = env.JWT_ACCESS_TTL as SignOptions['expiresIn'];

  return jwt.sign(
    { ...payload, type: 'access' },
    env.JWT_ACCESS_SECRET,
    { expiresIn }
  );
}

/**
 * Assina um token de refresh (longa duracao) com o segredo JWT_REFRESH_SECRET.
 *
 * @param payload Mesmo payload do token de acesso; o type eh forcado para "refresh".
 */
export function signRefresh(payload: Omit<JWTPayload, 'type'>) {
  const expiresIn = env.JWT_REFRESH_TTL as SignOptions['expiresIn'];

  return jwt.sign(
    { ...payload, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { expiresIn }
  );
}

/**
 * Valida a assinatura do token de acesso e retorna as claims originais.
 */
export function verifyAccess(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JWTPayload;
}

/**
 * Valida a assinatura do token de refresh e retorna as claims originais.
 */
export function verifyRefresh(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JWTPayload;
}
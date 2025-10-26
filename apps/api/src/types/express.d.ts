/* eslint-disable @typescript-eslint/no-namespace */
/**
 * Augmenta as definicoes de tipos do Express para que `Request` inclua as
 * propriedades customizadas usadas pela API multi-tenant.
 *
 * Centralizamos em um arquivo `.d.ts` dedicado para que o TypeScript carregue
 * automaticamente essas informacoes em todos os pontos do projeto.
 */

/* =========================[ ALTERAÇÃO ]======================================
 * Definimos um tipo mínimo e seguro para o usuário autenticado.
 * - Substitui o uso de `any` (que quebrava a regra no-explicit-any do ESLint).
 * - Permite propriedades adicionais sem perder segurança de tipos.
 * ============================================================================
 */
type AuthUser = {
  id: string;                    // identificador do usuário
  email?: string;                // e-mail opcional
  role?: 'admin' | 'user' | 'manager'; // papel opcional
  [k: string]: unknown;          // campos extras controlados como 'unknown'
};

declare namespace Express {
  interface Request {
    /**
     * Identificador do tenant atual, injetado pelo tenantMiddleware logo apos
     * a autenticacao. Permite que controllers e servicos saibam qual espaco de
     * dados consultar.
     */
    tenantId?: string;

    /* =====================[ ALTERAÇÃO ]======================================
     * Antes: `user?: any;`
     * Agora: tipamos como `AuthUser` para remover o `any` e agradar o ESLint.
     * =======================================================================
     */
    user?: AuthUser;
  }
}

/* eslint-enable @typescript-eslint/no-namespace */

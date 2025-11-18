/* eslint-disable @typescript-eslint/no-namespace */
/**
 * Tipagem do Request do Express com multi-tenant + auth JWT.
 * MantǸm a seguran��a de tipos e elimina `any`.
 */

type AuthRole = "ADMIN" | "ATTENDANT" | "OWNER";

type AuthUser = {
  /** Identificador do usuǭrio (igual ao `sub` do JWT) */
  userId: string;

  /** Identificador do tenant (igual ao `tid` do JWT) */
  tenantId: string;

  /** Papel (Role) do usuǭrio, em CAIXA ALTA conforme enum Prisma */
  role: AuthRole;

  /** Tipo do token (apenas informativo) */
  type?: "access";

  /** Campos extras (ex.: email, name) sem quebrar o tipo */
  email?: string;
  name?: string;
  [k: string]: unknown;
};

declare namespace Express {
  interface Request {
    /**
     * Injetado pelo tenant.middleware a partir da rota/host.
     * Usado para validar se o token pertence ao mesmo tenant.
     */
    tenantId?: string;

    /**
     * Preenchido pelo jwtAuth quando o access token Ǹ vǭlido.
     */
    user?: AuthUser;

    /**
     * Marcador usado nas requisi����es sem token ao criar o primeiro OWNER do tenant.
     */
    isBootstrapOwnerCreation?: boolean;

    /**
     * Populado quando um token valido do super admin acompanha a requisicao.
     */
    superAdmin?: {
      email: string;
    };

    /**
     * Identificador de request usado nos logs/telemetria.
     */
    requestId?: string;

    /**
     * Token de correla��o (propagado via header x-correlation-id).
     */
    correlationId?: string;
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

import { type Response } from "express";
import { Prisma } from "@prisma/client";

/**
 * Códigos padronizados de erro retornados pela API.
 * Mantê-los centralizados evita divergências entre handlers.
 */
export const ErrorCodes = {
  VALIDATION: "VALIDATION_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  TOKEN_MISSING: "AUTH_TOKEN_MISSING",
  TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  FORBIDDEN: "FORBIDDEN",
  TENANT_NOT_RESOLVED: "TENANT_NOT_RESOLVED",
  TENANT_NOT_FOUND: "TENANT_NOT_FOUND",
  BOOTSTRAP_LOCKED: "BOOTSTRAP_LOCKED",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  USER_CONFLICT: "USER_CONFLICT",
  TENANT_CONFLICT: "TENANT_CONFLICT",
  RESOURCE_CONFLICT: "RESOURCE_CONFLICT",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  REFRESH_INVALID: "REFRESH_INVALID",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  DB_SCHEMA_OUTDATED: "DB_SCHEMA_OUTDATED",
  INTERNAL: "INTERNAL_SERVER_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export type FieldError = {
  field: string;
  message: string;
  code?: string;
};

export type ErrorResponseBody = {
  error: {
    code: ErrorCode | string;
    message: string;
    details?: unknown;
    errors?: FieldError[];
  };
};

/**
 * Exceção de domínio que carrega metadados HTTP e garante resposta consistente.
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly code: ErrorCode | string;
  public readonly details?: unknown;
  public readonly errors?: FieldError[];

  constructor(options: {
    status: number;
    code: ErrorCode | string;
    message: string;
    details?: unknown;
    errors?: FieldError[];
    cause?: unknown;
  }) {
    super(options.message);
    this.name = "HttpError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.errors = options.errors;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

type BadRequestPayload =
  | string
  | {
      message?: string;
      details?: unknown;
      errors?: FieldError[];
    };

export class BadRequest extends HttpError {
  constructor(payload: BadRequestPayload) {
    const normalized =
      typeof payload === "string"
        ? { message: payload }
        : payload;

    super({
      status: 400,
      code: ErrorCodes.BAD_REQUEST,
      message: normalized.message ?? "Requisi\u00e7\u00e3o inv\u00e1lida.",
      details: normalized.details,
      errors: normalized.errors,
    });
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

/**
 * Constrói o corpo JSON esperado pelo front a partir de um HttpError.
 */
export function buildErrorBody(error: HttpError): ErrorResponseBody {
  const body: ErrorResponseBody = {
    error: {
      code: error.code,
      message: error.message,
    },
  };

  if (error.details !== undefined) {
    body.error.details = error.details;
  }

  if (error.errors?.length) {
    body.error.errors = error.errors;
  }

  return body;
}

/**
 * Transforma uma exceção qualquer em HttpError com fallback 500.
 */
export function normalizeError(error: unknown): HttpError {
  if (isHttpError(error)) {
    return error;
  }

  // Mensagens mais claras para erros comuns do Prisma.
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const msg = error.message || "Erro no banco de dados.";
    const needsMigration =
      error.code === "P2021" || // tabela/coluna ausente
      error.code === "P2022" ||
      /does not exist in the current database/i.test(msg);

    if (needsMigration) {
      return new HttpError({
        status: 500,
        code: ErrorCodes.DB_SCHEMA_OUTDATED,
        message: "Banco de dados desatualizado. Rode as migrations e reinicie o serviço.",
        details: { code: error.code },
        cause: error,
      });
    }

    return new HttpError({
      status: 400,
      code: ErrorCodes.BAD_REQUEST,
      message: msg,
      details: { code: error.code },
      cause: error,
    });
  }

  if (error instanceof Error && typeof (error as Partial<HttpError>).status === "number") {
    const status = (error as Partial<HttpError>).status ?? 500;
    const code = (error as Partial<HttpError>).code ?? ErrorCodes.INTERNAL;
    return new HttpError({
      status,
      code,
      message: error.message || "Erro interno do servidor.",
      details: (error as Partial<HttpError>).details,
      errors: (error as Partial<HttpError>).errors,
      cause: error,
    });
  }

  return new HttpError({
    status: 500,
    code: ErrorCodes.INTERNAL,
    message: "Erro interno do servidor.",
    details:
      error instanceof Error
        ? { name: error.name, message: error.message }
        : undefined,
    cause: error instanceof Error ? error : undefined,
  });
}

/**
 * Envia uma resposta de erro padronizada.
 */
export function respondWithError(
  res: Response,
  error: HttpError | {
    status: number;
    code: ErrorCode | string;
    message: string;
    details?: unknown;
    errors?: FieldError[];
  },
) {
  const httpError = error instanceof HttpError ? error : new HttpError(error);
  return res.status(httpError.status).json(buildErrorBody(httpError));
}

/**
 * Converte issues do Zod para o formato de FieldError.
 */
export function toFieldErrors(
  issues: Array<{ path: PropertyKey[]; message: string; code?: string }>,
): FieldError[] {
  return issues.map((issue) => ({
    field: issue.path.map(String).join("."),
    message: issue.message,
    code: issue.code,
  }));
}

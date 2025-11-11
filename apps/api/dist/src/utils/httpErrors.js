"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpError = exports.ErrorCodes = void 0;
exports.isHttpError = isHttpError;
exports.buildErrorBody = buildErrorBody;
exports.normalizeError = normalizeError;
exports.respondWithError = respondWithError;
exports.toFieldErrors = toFieldErrors;
/**
 * Códigos padronizados de erro retornados pela API.
 * Mantê-los centralizados evita divergências entre handlers.
 */
exports.ErrorCodes = {
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
    INTERNAL: "INTERNAL_SERVER_ERROR",
};
/**
 * Exceção de domínio que carrega metadados HTTP e garante resposta consistente.
 */
class HttpError extends Error {
    status;
    code;
    details;
    errors;
    constructor(options) {
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
exports.HttpError = HttpError;
function isHttpError(error) {
    return error instanceof HttpError;
}
/**
 * Constrói o corpo JSON esperado pelo front a partir de um HttpError.
 */
function buildErrorBody(error) {
    const body = {
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
function normalizeError(error) {
    if (isHttpError(error)) {
        return error;
    }
    if (error instanceof Error && typeof error.status === "number") {
        const status = error.status ?? 500;
        const code = error.code ?? exports.ErrorCodes.INTERNAL;
        return new HttpError({
            status,
            code,
            message: error.message || "Erro interno do servidor.",
            details: error.details,
            errors: error.errors,
            cause: error,
        });
    }
    return new HttpError({
        status: 500,
        code: exports.ErrorCodes.INTERNAL,
        message: "Erro interno do servidor.",
        details: error instanceof Error
            ? { name: error.name, message: error.message }
            : undefined,
        cause: error instanceof Error ? error : undefined,
    });
}
/**
 * Envia uma resposta de erro padronizada.
 */
function respondWithError(res, error) {
    const httpError = error instanceof HttpError ? error : new HttpError(error);
    return res.status(httpError.status).json(buildErrorBody(httpError));
}
/**
 * Converte issues do Zod para o formato de FieldError.
 */
function toFieldErrors(issues) {
    return issues.map((issue) => ({
        field: issue.path.map(String).join("."),
        message: issue.message,
        code: issue.code,
    }));
}
//# sourceMappingURL=httpErrors.js.map
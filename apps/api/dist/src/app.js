"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
exports.buildApp = buildApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const routes_1 = __importDefault(require("./routes"));
const routes_2 = __importDefault(require("./super-admin/routes"));
require("./prisma/client");
const httpErrors_1 = require("./utils/httpErrors");
const requestContext_1 = require("./middlewares/requestContext");
const env_1 = require("./config/env");
function buildApp() {
    const app = (0, express_1.default)();
    const normalizeOrigin = (origin) => origin
        ?.trim()
        .replace(/^['"]+|['"]+$/g, "")
        .replace(/\/$/, "");
    const configuredOrigins = env_1.env.CORS_ALLOWED_ORIGINS?.split(",")
        .map((origin) => normalizeOrigin(origin?.trim()))
        .filter(Boolean) ?? [];
    const devMode = process.env.NODE_ENV !== "production";
    const allowAllOrigins = devMode || configuredOrigins.includes("*");
    const explicitOrigins = allowAllOrigins
        ? []
        : configuredOrigins.length > 0
            ? configuredOrigins
            : [normalizeOrigin(env_1.env.APP_WEB_URL)];
    const explicitOriginsSet = new Set(explicitOrigins);
    const corsOptions = {
        origin: allowAllOrigins
            ? true
            : (incomingOrigin, callback) => {
                if (!incomingOrigin) {
                    return callback(null, true);
                }
                if (explicitOriginsSet.has(normalizeOrigin(incomingOrigin))) {
                    return callback(null, true);
                }
                return callback(null, false);
            },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "x-request-id", "x-correlation-id", "x-tenant-id"],
        optionsSuccessStatus: 204,
    };
    const corsMiddleware = (0, cors_1.default)(corsOptions);
    app.use(corsMiddleware);
    app.options(/.*/, corsMiddleware);
    app.use((0, cookie_parser_1.default)());
    app.use(express_1.default.json());
    app.use(requestContext_1.requestContext);
    app.use("/api/super-admin", routes_2.default);
    app.use("/api", routes_1.default);
    const errorHandler = (err, req, res, next) => {
        if (res.headersSent) {
            return next(err);
        }
        const httpError = (0, httpErrors_1.normalizeError)(err);
        const errorLog = {
            method: req.method,
            path: req.originalUrl ?? req.url,
            status: httpError.status,
            code: httpError.code,
            message: httpError.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
            tenantId: req.tenantId,
            userId: req.user?.userId,
            userRole: req.user?.role,
            stack: err instanceof Error ? err.stack : undefined,
        };
        console.error("Erro nao tratado:", errorLog);
        res.status(httpError.status).json((0, httpErrors_1.buildErrorBody)(httpError));
    };
    app.use(errorHandler);
    return app;
}
exports.app = buildApp();
//# sourceMappingURL=app.js.map
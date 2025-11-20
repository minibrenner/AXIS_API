import express, { type ErrorRequestHandler } from "express";
import cors, { type CorsOptions } from "cors";
import routes from "./routes";
import superAdminRouter from "./super-admin/routes";
import "./prisma/client";
import { buildErrorBody, normalizeError } from "./utils/httpErrors";
import { requestContext } from "./middlewares/requestContext";
import { env } from "./config/env";

export function buildApp() {
  const app = express();

  const normalizeOrigin = (origin?: string) =>
    origin
      ?.trim()
      .replace(/^['"]+|['"]+$/g, "")
      .replace(/\/$/, "");

  const configuredOrigins =
    env.CORS_ALLOWED_ORIGINS?.split(",")
      .map((origin) => normalizeOrigin(origin?.trim()))
      .filter(Boolean) ?? [];

  const devMode = process.env.NODE_ENV !== "production";
  const allowAllOrigins = devMode || configuredOrigins.includes("*");
  const explicitOrigins = allowAllOrigins
    ? []
    : configuredOrigins.length > 0
      ? configuredOrigins
      : [normalizeOrigin(env.APP_WEB_URL)];
  const explicitOriginsSet = new Set(explicitOrigins);

  const corsOptions: CorsOptions = {
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
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id", "x-correlation-id"],
    optionsSuccessStatus: 204,
  };

  const corsMiddleware = cors(corsOptions);
  app.use(corsMiddleware);
  app.options(/.*/, corsMiddleware);
  app.use(express.json());
  app.use(requestContext);
  app.use("/api/super-admin", superAdminRouter);
  app.use("/api", routes);

  const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }
    const httpError = normalizeError(err);

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

    res.status(httpError.status).json(buildErrorBody(httpError));
  };

  app.use(errorHandler);

  return app;
}

export const app = buildApp();

import express, { type ErrorRequestHandler } from "express";
import routes from "./routes";
import superAdminRouter from "./super-admin/routes";
import "./prisma/client";
import { buildErrorBody, normalizeError } from "./utils/httpErrors";
import { requestContext } from "./middlewares/requestContext";

export function buildApp() {
  const app = express();

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

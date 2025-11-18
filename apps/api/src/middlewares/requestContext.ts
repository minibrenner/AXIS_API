import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Popula identificadores usados nos logs de auditoria/seguran�a e
 * propaga cabe�alhos de correla��o entre servi�os.
 */
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const headerRequestId = (req.header("x-request-id") || "").trim();
  const headerCorrelationId = (req.header("x-correlation-id") || "").trim();

  const requestId = headerRequestId || randomUUID();
  const correlationId = headerCorrelationId || requestId;

  req.requestId = requestId;
  req.correlationId = correlationId;

  res.setHeader("x-request-id", requestId);
  res.setHeader("x-correlation-id", correlationId);

  return next();
}

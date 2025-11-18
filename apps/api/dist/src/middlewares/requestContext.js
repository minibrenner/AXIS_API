"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestContext = requestContext;
const node_crypto_1 = require("node:crypto");
/**
 * Popula identificadores usados nos logs de auditoria/seguran�a e
 * propaga cabe�alhos de correla��o entre servi�os.
 */
function requestContext(req, res, next) {
    const headerRequestId = (req.header("x-request-id") || "").trim();
    const headerCorrelationId = (req.header("x-correlation-id") || "").trim();
    const requestId = headerRequestId || (0, node_crypto_1.randomUUID)();
    const correlationId = headerCorrelationId || requestId;
    req.requestId = requestId;
    req.correlationId = correlationId;
    res.setHeader("x-request-id", requestId);
    res.setHeader("x-correlation-id", correlationId);
    return next();
}
//# sourceMappingURL=requestContext.js.map
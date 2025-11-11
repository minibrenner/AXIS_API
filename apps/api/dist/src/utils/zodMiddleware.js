"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withZod = withZod;
function withZod(schema) {
    return (req, res, next) => {
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
        }
        req.body = parsed.data;
        next();
    };
}
//# sourceMappingURL=zodMiddleware.js.map
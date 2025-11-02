"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = void 0;
const validateBody = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        const issues = result.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
            code: i.code,
        }));
        return res.status(400).json({ error: "Body inválido", issues });
    }
    req.body = result.data; // dado já validado/normalizado
    next();
};
exports.validateBody = validateBody;
//# sourceMappingURL=validateBody.js.map
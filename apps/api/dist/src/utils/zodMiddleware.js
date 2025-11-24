"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withZod = withZod;
const httpErrors_1 = require("./httpErrors");
function withZod(schema) {
    return (req, res, next) => {
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            const errors = (0, httpErrors_1.toFieldErrors)(parsed.error.issues);
            const error = new httpErrors_1.HttpError({
                status: 400,
                code: httpErrors_1.ErrorCodes.VALIDATION,
                message: "Alguns campos estao invalidos. Verifique os dados e tente novamente.",
                errors,
                details: { issues: parsed.error.issues },
            });
            return (0, httpErrors_1.respondWithError)(res, error);
        }
        req.body = parsed.data;
        next();
    };
}
//# sourceMappingURL=zodMiddleware.js.map
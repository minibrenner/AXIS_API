"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = void 0;
const httpErrors_1 = require("../utils/httpErrors");
const validateBody = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        return (0, httpErrors_1.respondWithError)(res, {
            status: 422,
            code: httpErrors_1.ErrorCodes.VALIDATION,
            message: "Body invalido",
            errors: (0, httpErrors_1.toFieldErrors)(result.error.issues.map((issue) => ({
                path: issue.path,
                message: issue.message,
                code: issue.code,
            }))),
        });
    }
    req.body = result.data; // dado ja validado/normalizado
    next();
};
exports.validateBody = validateBody;
//# sourceMappingURL=validateBody.js.map
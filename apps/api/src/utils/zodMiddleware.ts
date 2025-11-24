// apps/api/src/utils/zodMiddleware.ts - helper de validacao
import type { ZodTypeAny } from "zod";
import type { Request, Response, NextFunction } from "express";
import { ErrorCodes, HttpError, respondWithError, toFieldErrors } from "./httpErrors";

export function withZod(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error.issues);

      const error = new HttpError({
        status: 400,
        code: ErrorCodes.VALIDATION,
        message:
          "Alguns campos estao invalidos. Verifique os dados e tente novamente.",
        errors,
        details: { issues: parsed.error.issues },
      });

      return respondWithError(res, error);
    }

    req.body = parsed.data;
    next();
  };
}

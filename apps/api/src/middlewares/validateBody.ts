import { type Request, type Response, type NextFunction } from "express";
import { ZodSchema } from "zod";
import { ErrorCodes, respondWithError, toFieldErrors } from "../utils/httpErrors";

export const validateBody =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return respondWithError(res, {
        status: 422,
        code: ErrorCodes.VALIDATION,
        message: "Body invalido",
        errors: toFieldErrors(
          result.error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
            code: issue.code,
          }))
        ),
      });
    }

    req.body = result.data; // dado ja validado/normalizado
    next();
  };

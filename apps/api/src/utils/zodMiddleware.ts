// apps/api/src/utils/zodMiddleware.ts — helper de validação
import type { ZodTypeAny } from "zod";
import type { Request, Response, NextFunction } from "express";

export function withZod(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
    }
    req.body = parsed.data;
    next();
  };
}

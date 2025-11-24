import multer, { MulterError, type FileFilterCallback } from "multer";
import type { Request, Response, NextFunction } from "express";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024, // 4MB
    files: 1,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const mime = file.mimetype.toLowerCase();
    if (mime === "image/jpeg" || mime === "image/jpg" || mime === "image/png") {
      cb(null, true);
    } else {
      // Formato incompatível: tratamos como "sem arquivo" para cair no placeholder
      cb(null, false);
    }
  },
});

export function uploadSingleImage(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(fieldName)(req, res, (err: unknown) => {
      if (!err) return next();

      if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Imagem deve ter no máximo 4MB." });
      }

      return next(err);
    });
  };
}

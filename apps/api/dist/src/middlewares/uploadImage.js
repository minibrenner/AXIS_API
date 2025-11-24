"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadSingleImage = uploadSingleImage;
const multer_1 = __importStar(require("multer"));
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 4 * 1024 * 1024, // 4MB
        files: 1,
    },
    fileFilter: (_req, file, cb) => {
        const mime = file.mimetype.toLowerCase();
        if (mime === "image/jpeg" || mime === "image/jpg" || mime === "image/png") {
            cb(null, true);
        }
        else {
            // Formato incompatível: tratamos como "sem arquivo" para cair no placeholder
            cb(null, false);
        }
    },
});
function uploadSingleImage(fieldName) {
    return (req, res, next) => {
        upload.single(fieldName)(req, res, (err) => {
            if (!err)
                return next();
            if (err instanceof multer_1.MulterError && err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({ error: "Imagem deve ter no máximo 4MB." });
            }
            return next(err);
        });
    };
}
//# sourceMappingURL=uploadImage.js.map
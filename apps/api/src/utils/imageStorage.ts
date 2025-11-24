import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { env } from "../config/env";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4MB
const MAX_PROCESSED_BYTES = 2 * 1024 * 1024; // 2MB

const r2Client = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

type ImageKind = "category" | "product";

type ProcessOptions = {
  size: number;
};

const IMAGE_SPECS: Record<ImageKind, ProcessOptions> = {
  category: { size: 800 },
  product: { size: 400 },
};

const CATEGORY_PLACEHOLDER_KEY = "static/placeholders/category-default.svg";
const PRODUCT_PLACEHOLDER_KEY = "static/placeholders/product-default.svg";

// SVG genérico fornecido (usado para categorias e produtos)
const GENERIC_PLACEHOLDER_SVG = `<svg width="320" height="320" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="axis-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#020617"/>
      <stop offset="100%" stop-color="#0B1120"/>
    </linearGradient>
    <linearGradient id="axis-glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(148,163,184,0.25)"/>
      <stop offset="100%" stop-color="rgba(30,64,175,0.35)"/>
    </linearGradient>
  </defs>

  <!-- Fundo -->
  <rect x="0" y="0" width="320" height="320" rx="32" fill="url(#axis-bg)"/>

  <!-- Efeito de vidro -->
  <rect x="40" y="56" width="240" height="208" rx="24"
        fill="rgba(15,23,42,0.7)" stroke="rgba(148,163,184,0.6)" stroke-width="1.5"/>

  <!-- Ícone de produto / sacola -->
  <rect x="110" y="100" width="100" height="80" rx="18"
        fill="rgba(15,23,42,0.8)" stroke="rgba(148,163,184,0.8)" stroke-width="2"/>
  <path d="M122 132 C122 120 132 110 144 110 H176 C188 110 198 120 198 132"
        fill="none" stroke="rgba(148,163,184,0.8)" stroke-width="2.5"
        stroke-linecap="round"/>

  <!-- Carinha feliz -->
  <circle cx="138" cy="142" r="5" fill="#E5E7EB"/>
  <circle cx="182" cy="142" r="5" fill="#E5E7EB"/>
  <path d="M144 160 C152 168 168 168 176 160"
        fill="none" stroke="#E5E7EB" stroke-width="2.5" stroke-linecap="round"/>

  <!-- Estrelinhas -->
  <circle cx="88" cy="96" r="3" fill="#38BDF8"/>
  <circle cx="232" cy="96" r="2.5" fill="#A855F7"/>
  <circle cx="80" cy="192" r="2.5" fill="#22C55E"/>
  <circle cx="240" cy="210" r="3" fill="#F97316"/>

  <!-- Texto “IMAGEM EM BREVE” -->
  <text x="50%" y="220"
        text-anchor="middle"
        fill="#E5E7EB"
        font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="16"
        font-weight="500">
    IMAGEM EM BREVE
  </text>
</svg>`;

export async function ensurePlaceholderImage(kind: ImageKind): Promise<string> {
  const key = kind === "category" ? CATEGORY_PLACEHOLDER_KEY : PRODUCT_PLACEHOLDER_KEY;

  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
        Body: Buffer.from(GENERIC_PLACEHOLDER_SVG, "utf-8"),
        ContentType: "image/svg+xml",
        CacheControl: "public, max-age=31536000",
      }),
    );
  } catch (err) {
    console.error("Falha ao subir placeholder genérico no storage:", err);
  }

  return key;
}

export async function processAndUploadImage(
  kind: ImageKind,
  tenantId: string,
  entityId: string,
  file: Express.Multer.File,
): Promise<string> {
  if (!file) {
    throw new Error("Nenhum arquivo de imagem foi enviado.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Imagem deve ter no m\u00e1ximo 4MB.");
  }

  const mime = file.mimetype.toLowerCase();
  const isJpeg = mime === "image/jpeg" || mime === "image/jpg";
  const isPng = mime === "image/png";

  if (!isJpeg && !isPng) {
    throw new Error("Formato de imagem inv\u00e1lido. Use JPEG ou PNG.");
  }

  const { size } = IMAGE_SPECS[kind];

  const baseSharp = sharp(file.buffer)
    .resize(size, size, {
      fit: "cover",
      position: "center",
    })
    .withMetadata({ density: 72 });

  const ext = isPng ? "png" : "jpg";
  let quality = 80;
  let output: Buffer | null = null;

  for (let i = 0; i < 4; i++) {
    const instance = baseSharp.clone();
    if (ext === "png") {
      output = await instance.png({ compressionLevel: 9, quality }).toBuffer();
    } else {
      output = await instance
        .jpeg({
          quality,
          chromaSubsampling: "4:4:4",
          mozjpeg: true,
        })
        .toBuffer();
    }

    if (output.byteLength <= MAX_PROCESSED_BYTES) {
      break;
    }
    quality -= 10;
  }

  if (!output || output.byteLength > MAX_PROCESSED_BYTES) {
    throw new Error("N\u00e3o foi poss\u00edvel reduzir a imagem para at\u00e9 2MB.");
  }

  const safeFilename = file.originalname.replace(/[^a-z0-9.\-_]/gi, "_").toLowerCase();
  const key = [
    "tenants",
    tenantId,
    kind === "category" ? "categories" : "products",
    `${entityId}_${Date.now()}_${safeFilename}`,
  ].join("/");

  await r2Client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: output,
      ContentType: ext === "png" ? "image/png" : "image/jpeg",
    }),
  );

  return key;
}

export async function deleteImageFromStorage(imagePath?: string | null) {
  if (!imagePath) return;

  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: imagePath,
      }),
    );
  } catch (err) {
    // best-effort: n\u00e3o quebra a requisi\u00e7\u00e3o se falhar
    console.error("Falha ao excluir imagem antiga do storage:", err);
  }
}

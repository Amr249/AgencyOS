import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, "") ?? "";

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim() &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim() &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim() &&
      process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim() &&
      process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim()
  );
}

let _r2Client: S3Client | null = null;

function createR2Client(): S3Client {
  const accountId = requireEnv(
    "CLOUDFLARE_R2_ACCOUNT_ID",
    process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim()
  );
  const accessKeyId = requireEnv(
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim()
  );
  const secretAccessKey = requireEnv(
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim()
  );
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export function getR2Client(): S3Client {
  if (!isR2Configured()) {
    throw new Error("Cloudflare R2 is not configured");
  }
  if (!_r2Client) {
    _r2Client = createR2Client();
  }
  return _r2Client;
}

/** Lazily delegates to {@link getR2Client} so importing this module does not require env at load time. */
export const r2Client = new Proxy({} as S3Client, {
  get(_target, prop) {
    const c = getR2Client();
    const value = Reflect.get(c, prop, c) as unknown;
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(c);
    }
    return value;
  },
}) as S3Client;

function getBucket(): string {
  return requireEnv("CLOUDFLARE_R2_BUCKET_NAME", bucket?.trim());
}

function getPublicBase(): string {
  return requireEnv("CLOUDFLARE_R2_PUBLIC_URL", publicUrl || undefined);
}

/** Sanitizes a filename: safe stem + preserved extension. */
export function sanitizeFilename(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, "");
  const lastDot = base.lastIndexOf(".");
  const ext = lastDot >= 0 ? base.slice(lastDot) : "";
  const stem = lastDot >= 0 ? base.slice(0, lastDot) : base;
  const safeStem =
    stem.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "file";
  const safeExt = ext.replace(/[^a-zA-Z0-9.]+/g, "").slice(0, 16);
  return `${safeStem}${safeExt}`;
}

export async function uploadToR2(
  file: Buffer,
  key: string,
  contentType: string
): Promise<{ key: string; url: string }> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: file,
      ContentType: contentType,
    })
  );
  const base = getPublicBase();
  return { key, url: `${base}/${key}` };
}

export async function deleteFromR2(key: string): Promise<void> {
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );
}

export async function deleteMultipleFromR2(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await getR2Client().send(
    new DeleteObjectsCommand({
      Bucket: getBucket(),
      Delete: {
        Objects: keys.map((Key) => ({ Key })),
        Quiet: true,
      },
    })
  );
}

export async function getPresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  return getSignedUrl(getR2Client(), command, { expiresIn });
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 900
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getR2Client(), command, { expiresIn });
}

export function getPublicUrl(key: string): string {
  const base = getPublicBase();
  return `${base}/${key}`;
}

export function generateFileKey(
  scope: string,
  id: string,
  filename: string
): string {
  const safe = sanitizeFilename(filename);
  return `${scope}/${id}/${Date.now()}_${safe}`;
}

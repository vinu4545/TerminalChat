import { mkdirSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";

export const MAX_UPLOAD_BYTES = Math.min(
  Math.max(Number(process.env.UPLOAD_MAX_BYTES) || 10 * 1024 * 1024, 1),
  50 * 1024 * 1024,
);
export const MAX_UPLOAD_FILES = Math.min(
  Math.max(Number(process.env.UPLOAD_MAX_FILES) || 5, 1),
  10,
);

export const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
mkdirSync(UPLOAD_DIR, { recursive: true });

const allowedTypes: Record<string, Set<string>> = {
  ".jpg": new Set(["image/jpeg"]),
  ".jpeg": new Set(["image/jpeg"]),
  ".png": new Set(["image/png"]),
  ".gif": new Set(["image/gif"]),
  ".webp": new Set(["image/webp"]),
  ".svg": new Set(["image/svg+xml"]),
  ".pdf": new Set(["application/pdf"]),
  ".txt": new Set(["text/plain"]),
  ".csv": new Set(["text/csv", "application/csv", "application/vnd.ms-excel"]),
  ".md": new Set(["text/markdown", "text/plain"]),
  ".json": new Set(["application/json", "text/json"]),
  ".xml": new Set(["application/xml", "text/xml"]),
  ".yaml": new Set(["application/yaml", "text/yaml"]),
  ".yml": new Set(["application/yaml", "text/yaml"]),
  ".log": new Set(["text/plain"]),
  ".doc": new Set(["application/msword"]),
  ".docx": new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
  ".xls": new Set(["application/vnd.ms-excel"]),
  ".xlsx": new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]),
  ".ppt": new Set(["application/vnd.ms-powerpoint"]),
  ".pptx": new Set(["application/vnd.openxmlformats-officedocument.presentationml.presentation"]),
  ".zip": new Set(["application/zip", "application/x-zip-compressed"]),
  ".tar": new Set(["application/x-tar"]),
  ".gz": new Set(["application/gzip", "application/x-gzip"]),
  ".rar": new Set(["application/vnd.rar", "application/x-rar-compressed"]),
};

const sourceExtensions = new Set([
  ".c", ".h", ".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx",
  ".java", ".py", ".pyw", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".html", ".htm", ".css", ".scss", ".sh", ".bash", ".ps1", ".bat", ".cmd",
  ".sql", ".r", ".go", ".rs", ".php", ".rb", ".swift", ".kt", ".kts",
  ".dart", ".vue", ".svelte", ".graphql", ".proto", ".toml", ".ini", ".conf",
]);
const specialSourceNames = new Set([".env.example", ".gitignore", "dockerfile", "makefile"]);
const genericTextMimeTypes = new Set(["application/octet-stream", "binary/octet-stream"]);

function isSourceFile(file: Pick<Express.Multer.File, "originalname" | "mimetype">) {
  const name = path.basename(file.originalname).toLowerCase();
  const extension = path.extname(name);
  return (
    sourceExtensions.has(extension) ||
    specialSourceNames.has(name)
  ) && (
    file.mimetype.startsWith("text/") ||
    genericTextMimeTypes.has(file.mimetype) ||
    ["application/javascript", "application/typescript", "application/json"].includes(file.mimetype)
  );
}

export function isAllowedUpload(file: Pick<Express.Multer.File, "originalname" | "mimetype">) {
  const extension = path.extname(file.originalname).toLowerCase();
  return isSourceFile(file) || Boolean(allowedTypes[extension]?.has(file.mimetype));
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
  filename: (_req, file, callback) => {
    callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_UPLOAD_FILES },
  fileFilter: (_req, file, callback) => {
    if (!isAllowedUpload(file)) {
      callback(new Error("UNSUPPORTED_FILE_TYPE"));
      return;
    }
    callback(null, true);
  },
});

export async function validateStoredFile(file: Express.Multer.File) {
  const name = path.basename(file.originalname).toLowerCase();
  const extension = path.extname(name);
  const data = await readFile(file.path).catch(() => Buffer.alloc(0));
  const bytes = data.subarray(0, 16);
  const header = data.subarray(0, 4096).toString("utf8");
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const isOle = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  const isText = !data.includes(0);

  if (
    [".txt", ".csv", ".md", ".json", ".xml", ".yaml", ".yml", ".log"].includes(extension) ||
    sourceExtensions.has(extension) ||
    specialSourceNames.has(name)
  ) {
    return isText;
  }
  if ([".docx", ".xlsx", ".pptx", ".zip", ".tar", ".gz", ".rar"].includes(extension)) {
    return extension === ".tar" || isZip || bytes[0] === 0x1f && bytes[1] === 0x8b;
  }
  if ([".doc", ".xls", ".ppt"].includes(extension)) return isOle;
  if (extension === ".pdf") return header.startsWith("%PDF-");
  if ([".jpg", ".jpeg"].includes(extension)) return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (extension === ".png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (extension === ".gif") return header.startsWith("GIF8");
  if (extension === ".webp") return header.startsWith("RIFF") && header.slice(8, 12) === "WEBP";
  if (extension === ".svg") return /<svg(?:\s|>)/i.test(header.slice(0, 4096));
  return false;
}

export async function removeUploadedFiles(files: Express.Multer.File[]) {
  await Promise.all(
    files.map((file) => unlink(path.join(UPLOAD_DIR, file.filename)).catch(() => undefined)),
  );
}

export async function removeStoredFiles(storageKeys: string[]) {
  await Promise.all(
    storageKeys.map((storageKey) => {
      try {
        return unlink(getSafeUploadPath(storageKey)).catch(() => undefined);
      } catch {
        return Promise.resolve();
      }
    }),
  );
}

export function getSafeUploadPath(storageKey: string) {
  if (!storageKey || path.basename(storageKey) !== storageKey || storageKey.includes("\0")) {
    throw new Error("INVALID_STORAGE_KEY");
  }
  return path.join(UPLOAD_DIR, storageKey);
}
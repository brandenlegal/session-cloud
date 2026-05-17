import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";

const ALLOWED_EXT = new Set([".wav", ".mp3", ".flac", ".m4a", ".aac"]);

export function resolveUploadRoot() {
  const raw = process.env.UPLOAD_DIR ?? "./uploads";
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function extAllowed(filename) {
  return ALLOWED_EXT.has(path.extname(filename).toLowerCase());
}

export function createUploadMiddleware() {
  const storage = multer.diskStorage({
    destination(req, _file, cb) {
      const userId = req.user?.id;
      if (!userId) {
        const err = new Error("Unauthorized");
        err.status = 401;
        return cb(err);
      }
      const dir = path.join(resolveUploadRoot(), userId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${randomUUID()}${ext}`);
    },
  });

  const maxBytes = Number(process.env.MAX_FILE_SIZE ?? 104857600);

  return multer({
    storage,
    limits: { fileSize: maxBytes },
    fileFilter(_req, file, cb) {
      if (!extAllowed(file.originalname)) {
        const err = new Error(
          "Invalid format. Allowed: .wav, .mp3, .flac, .m4a, .aac",
        );
        err.status = 400;
        return cb(err);
      }
      cb(null, true);
    },
  });
}

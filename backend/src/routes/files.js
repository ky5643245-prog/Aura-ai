import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { db } from "../database/db.js";

const router = Router();
const uploadDir = path.resolve("data/uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const allowed = new Map([
  ["text/plain", ".txt"],
  ["application/json", ".json"],
  ["text/csv", ".csv"],
  ["application/pdf", ".pdf"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"]
]);

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, allowed.has(file.mimetype))
});

async function extract(file) {
  if (file.mimetype.startsWith("image/")) return null;
  if (file.mimetype === "application/pdf") {
    const parsed = await pdfParse(fs.readFileSync(file.path));
    return parsed.text.slice(0, 50000);
  }
  if (file.mimetype.includes("wordprocessingml")) {
    const result = await mammoth.extractRawText({ path: file.path });
    return result.value.slice(0, 50000);
  }
  return fs.readFileSync(file.path, "utf8").slice(0, 50000);
}

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Unsupported or missing file." });

  try {
    const extracted = await extract(req.file);
    const ext = allowed.get(req.file.mimetype);
    const storedName = `${crypto.randomUUID()}${ext}`;
    const target = path.join(uploadDir, storedName);
    fs.renameSync(req.file.path, target);

    const info = db.prepare(`
      INSERT INTO attachments(user_id,original_name,stored_name,mime_type,size,extracted_text)
      VALUES(?,?,?,?,?,?)
    `).run(req.session.userId, req.file.originalname.slice(0, 180), storedName, req.file.mimetype, req.file.size, extracted);

    res.status(201).json({
      attachment: {
        id: Number(info.lastInsertRowid),
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size,
        text: extracted
      }
    });
  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch {}
    res.status(400).json({ error: "The file could not be processed." });
  }
});

export default router;

import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, getUserById } from "../database/db.js";

const router = Router();
const authSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(120)
});

router.post("/signup", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Use a valid email and a password of at least 8 characters." });

  const { name = "User", email, password } = parsed.data;
  const exists = db.prepare("SELECT id FROM users WHERE email=?").get(email.toLowerCase());
  if (exists) return res.status(409).json({ error: "An account with that email already exists." });

  const hash = await bcrypt.hash(password, 12);
  const info = db.prepare("INSERT INTO users(name,email,password_hash) VALUES(?,?,?)")
    .run(name, email.toLowerCase(), hash);

  db.prepare("INSERT INTO settings(user_id) VALUES(?)").run(info.lastInsertRowid);
  req.session.userId = Number(info.lastInsertRowid);
  res.status(201).json({ user: getUserById(req.session.userId) });
});

router.post("/login", async (req, res) => {
  const parsed = authSchema.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid email or password." });

  const user = db.prepare("SELECT * FROM users WHERE email=?").get(parsed.data.email.toLowerCase());
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  req.session.userId = user.id;
  res.json({ user: getUserById(user.id) });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/me", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not signed in." });
  res.json({ user: getUserById(req.session.userId) });
});

export default router;

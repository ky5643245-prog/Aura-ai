import { Router } from "express";
import { z } from "zod";
import { db } from "../database/db.js";

const router = Router();

router.get("/", (req, res) => {
  const settings = db.prepare("SELECT * FROM settings WHERE user_id=?").get(req.session.userId);
  res.json({ settings });
});

router.patch("/", (req, res) => {
  const schema = z.object({
    theme: z.enum(["dark","light"]).optional(),
    language: z.string().max(40).optional(),
    compact_mode: z.boolean().optional(),
    enter_to_send: z.boolean().optional(),
    model: z.string().max(100).optional(),
    temperature: z.number().min(0).max(2).optional(),
    history_enabled: z.boolean().optional(),
    auto_scroll: z.boolean().optional(),
    markdown: z.boolean().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid settings." });

  const s = parsed.data;
  const values = [
    s.theme, s.language, s.compact_mode, s.enter_to_send, s.model,
    s.temperature, s.history_enabled, s.auto_scroll, s.markdown
  ];

  const current = db.prepare("SELECT * FROM settings WHERE user_id=?").get(req.session.userId);
  const next = {
    theme: s.theme ?? current.theme,
    language: s.language ?? current.language,
    compact_mode: s.compact_mode ?? Boolean(current.compact_mode),
    enter_to_send: s.enter_to_send ?? Boolean(current.enter_to_send),
    model: s.model ?? current.model,
    temperature: s.temperature ?? current.temperature,
    history_enabled: s.history_enabled ?? Boolean(current.history_enabled),
    auto_scroll: s.auto_scroll ?? Boolean(current.auto_scroll),
    markdown: s.markdown ?? Boolean(current.markdown)
  };

  db.prepare(`
    UPDATE settings SET theme=?,language=?,compact_mode=?,enter_to_send=?,model=?,temperature=?,
    history_enabled=?,auto_scroll=?,markdown=? WHERE user_id=?
  `).run(
    next.theme, next.language, next.compact_mode ? 1 : 0, next.enter_to_send ? 1 : 0,
    next.model, next.temperature, next.history_enabled ? 1 : 0, next.auto_scroll ? 1 : 0,
    next.markdown ? 1 : 0, req.session.userId
  );

  res.json({ settings: db.prepare("SELECT * FROM settings WHERE user_id=?").get(req.session.userId) });
});

export default router;

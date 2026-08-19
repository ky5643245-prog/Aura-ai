import { Router } from "express";
import { z } from "zod";
import { db, getConversationForUser } from "../database/db.js";

const router = Router();

router.get("/", (req, res) => {
  const q = String(req.query.q || "").trim();
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);

  if (q) {
    const like = `%${q}%`;
    const rows = db.prepare(`
      SELECT DISTINCT c.*
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id=c.id
      WHERE c.user_id=? AND (c.title LIKE ? OR m.content LIKE ?)
      ORDER BY c.pinned DESC, c.updated_at DESC
      LIMIT ?
    `).all(req.session.userId, like, like, limit);
    return res.json({ conversations: rows });
  }

  const rows = db.prepare(`
    SELECT * FROM conversations
    WHERE user_id=?
    ORDER BY pinned DESC, updated_at DESC
    LIMIT ?
  `).all(req.session.userId, limit);

  res.json({ conversations: rows });
});

router.post("/", (req, res) => {
  const info = db.prepare("INSERT INTO conversations(user_id,title) VALUES(?,?)")
    .run(req.session.userId, "New chat");
  res.status(201).json({ conversation: getConversationForUser(info.lastInsertRowid, req.session.userId) });
});

router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const conversation = getConversationForUser(id, req.session.userId);
  if (!conversation) return res.status(404).json({ error: "Conversation not found." });

  const messages = db.prepare(`
    SELECT id, role, content, created_at
    FROM messages WHERE conversation_id=? ORDER BY id ASC
  `).all(id);

  res.json({ conversation, messages });
});

router.patch("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!getConversationForUser(id, req.session.userId)) return res.status(404).json({ error: "Conversation not found." });

  const schema = z.object({
    title: z.string().trim().min(1).max(120).optional(),
    pinned: z.boolean().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid conversation update." });

  if (parsed.data.title !== undefined) db.prepare("UPDATE conversations SET title=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(parsed.data.title, id);
  if (parsed.data.pinned !== undefined) db.prepare("UPDATE conversations SET pinned=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(parsed.data.pinned ? 1 : 0, id);

  res.json({ conversation: getConversationForUser(id, req.session.userId) });
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare("DELETE FROM conversations WHERE id=? AND user_id=?").run(id, req.session.userId);
  if (!result.changes) return res.status(404).json({ error: "Conversation not found." });
  res.json({ ok: true });
});

router.post("/:id/duplicate", (req, res) => {
  const id = Number(req.params.id);
  const original = getConversationForUser(id, req.session.userId);
  if (!original) return res.status(404).json({ error: "Conversation not found." });

  const tx = db.transaction(() => {
    const copy = db.prepare("INSERT INTO conversations(user_id,title,pinned) VALUES(?,?,0)")
      .run(req.session.userId, `${original.title} (copy)`);
    const messages = db.prepare("SELECT role,content FROM messages WHERE conversation_id=? ORDER BY id").all(id);
    const insert = db.prepare("INSERT INTO messages(conversation_id,role,content) VALUES(?,?,?)");
    for (const m of messages) insert.run(copy.lastInsertRowid, m.role, m.content);
    return getConversationForUser(copy.lastInsertRowid, req.session.userId);
  });

  res.status(201).json({ conversation: tx() });
});

router.get("/:id/export", (req, res) => {
  const id = Number(req.params.id);
  const conversation = getConversationForUser(id, req.session.userId);
  if (!conversation) return res.status(404).json({ error: "Conversation not found." });

  const messages = db.prepare("SELECT role,content,created_at FROM messages WHERE conversation_id=? ORDER BY id").all(id);
  const lines = [`# ${conversation.title}`, "", ...messages.map(m => `## ${m.role}\n\n${m.content}\n`)];
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="conversation-${id}.md"`);
  res.send(lines.join("\n"));
});

export default router;

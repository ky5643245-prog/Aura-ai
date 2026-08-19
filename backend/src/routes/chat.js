import { Router } from "express";
import { z } from "zod";
import { db, getConversationForUser } from "../database/db.js";
import { streamAI, isRealProvider } from "../services/aiProvider.js";

const router = Router();
const bodySchema = z.object({
  conversationId: z.number().int().positive(),
  content: z.string().trim().min(1).max(20000),
  model: z.string().max(100).optional()
});

function writeSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function handleChat(req, res, { conversationId, content, regenerate = false }) {
  const conversation = getConversationForUser(conversationId, req.session.userId);
  if (!conversation) return res.status(404).json({ error: "Conversation not found." });

  if (!regenerate) {
    db.prepare("INSERT INTO messages(conversation_id,role,content) VALUES(?,?,?)")
      .run(conversationId, "user", content);
    if (conversation.title === "New chat") {
      const title = content.replace(/\s+/g, " ").slice(0, 52) || "New chat";
      db.prepare("UPDATE conversations SET title=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(title, conversationId);
    }
  }

  const history = db.prepare(`
    SELECT role,content FROM messages
    WHERE conversation_id=? AND role IN ('user','assistant')
    ORDER BY id ASC LIMIT 80
  `).all(conversationId);

  if (regenerate && history.at(-1)?.role === "assistant") history.pop();

  const controller = new AbortController();
  req.on("close", () => controller.abort());

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let answer = "";
  try {

   writeSSE(res, "meta", {
  mode: isRealProvider() ? "live" : "development"
});

    for await (const chunk of streamAI(history, controller.signal)) {
      answer += chunk;
      writeSSE(res, "delta", { text: chunk });
    }

    if (!answer.trim()) throw new Error("The AI returned an empty response.");

    db.prepare("INSERT INTO messages(conversation_id,role,content) VALUES(?,?,?)")
      .run(conversationId, "assistant", answer);
    db.prepare("UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?").run(conversationId);

    writeSSE(res, "done", { content: answer });
  } catch (err) {
    if (!controller.signal.aborted) {
      writeSSE(res, "error", {
        message: err.message || "AI request failed."
      });
    }
  } finally {
    res.end();
  }
}

router.post("/", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Message is required." });
  await handleChat(req, res, parsed.data);
});


router.post("/edit", async (req, res) => {
  const parsed = z.object({
    conversationId: z.number().int().positive(),
    messageId: z.number().int().positive(),
    content: z.string().trim().min(1).max(20000)
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: "Invalid edit request." });

  const conversation = getConversationForUser(parsed.data.conversationId, req.session.userId);
  if (!conversation) return res.status(404).json({ error: "Conversation not found." });

  const target = db.prepare(`
    SELECT id, role FROM messages
    WHERE id=? AND conversation_id=?
  `).get(parsed.data.messageId, parsed.data.conversationId);

  if (!target || target.role !== "user") {
    return res.status(404).json({ error: "Editable user message not found." });
  }

  db.prepare("DELETE FROM messages WHERE conversation_id=? AND id>=?")
    .run(parsed.data.conversationId, parsed.data.messageId);

  await handleChat(req, res, {
    conversationId: parsed.data.conversationId,
    content: parsed.data.content,
    regenerate: false
  });
});

router.post("/regenerate", async (req, res) => {
  const parsed = z.object({ conversationId: z.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Conversation is required." });
  await handleChat(req, res, { conversationId: parsed.data.conversationId, regenerate: true });
});

export default router;

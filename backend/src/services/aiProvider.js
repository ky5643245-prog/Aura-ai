const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function cleanText(text) {
  return String(text ?? "").trim();
}

/*
|--------------------------------------------------------------------------
| Ollama Configuration
|--------------------------------------------------------------------------
*/

const OLLAMA_BASE_URL = (
  process.env.OLLAMA_BASE_URL ||
  "http://127.0.0.1:11434"
).replace(/\/+$/, "");

const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL ||
  "llama3.2:latest";

/*
|--------------------------------------------------------------------------
| Provider status
|--------------------------------------------------------------------------
*/

export function isRealProvider() {
  return true;
}

/*
|--------------------------------------------------------------------------
| Ollama streaming
|--------------------------------------------------------------------------
*/

async function* ollamaStream(messages, signal) {
  const response = await fetch(
    `${OLLAMA_BASE_URL}/api/chat`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        model: OLLAMA_MODEL,

        messages: messages
          .filter(
            (message) =>
              message &&
              (message.role === "user" ||
                message.role === "assistant" ||
                message.role === "system")
          )
          .map((message) => ({
            role: message.role,
            content: cleanText(message.content),
          })),

        stream: true,

        options: {
          temperature: Number(
            process.env.AI_TEMPERATURE || 0.7
          ),
        },
      }),

      signal,
    }
  );

  if (!response.ok) {
    const body = await response
      .text()
      .catch(() => "");

    throw new Error(
      `Ollama error (${response.status}): ${
        body || "Unable to connect to Ollama."
      }`
    );
  }

  if (!response.body) {
    throw new Error(
      "Ollama returned no streaming response."
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) {
        return;
      }

      const { value, done } =
        await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, {
        stream: true,
      });

      const lines = buffer.split("\n");

      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
          continue;
        }

        try {
          const json = JSON.parse(trimmed);

          if (
            json.message &&
            typeof json.message.content === "string"
          ) {
            yield json.message.content;
          }

          if (json.done === true) {
            return;
          }
        } catch {
          // Ollama sends one JSON object per line.
          // Ignore incomplete chunks.
        }
      }
    }

    /*
     * Process anything remaining in the buffer.
     */
    const finalLine = buffer.trim();

    if (finalLine) {
      try {
        const json = JSON.parse(finalLine);

        if (
          json.message &&
          typeof json.message.content === "string"
        ) {
          yield json.message.content;
        }
      } catch {
        // Ignore incomplete final chunk.
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Reader already released.
    }
  }
}

/*
|--------------------------------------------------------------------------
| Main AI stream
|--------------------------------------------------------------------------
*/

export async function* streamAI(messages, signal) {
  if (signal?.aborted) {
    return;
  }

  try {
    yield* ollamaStream(messages, signal);
  } catch (error) {
    if (signal?.aborted) {
      return;
    }

    console.error(
      "[AURA/Ollama]",
      error
    );

    const message =
      error?.message ||
      "Ollama AI request failed.";

    const fallback =
      `## AURA AI — Local AI Error\n\n` +
      `I couldn't connect to the local Ollama model.\n\n` +
      `**Error:** ${message}\n\n` +
      `### Check Ollama\n\n` +
      "```powershell\n" +
      "ollama list\n" +
      "```\n\n" +
      `Your model should be:\n\n` +
      "```text\n" +
      "llama3.2:latest\n" +
      "```\n";

    const chunks =
      fallback.match(/.{1,25}/gs) ||
      [fallback];

    for (const chunk of chunks) {
      if (signal?.aborted) {
        return;
      }

      await sleep(10);

      yield chunk;
    }
  }
}
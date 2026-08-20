
// src/services/api.js

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

function buildUrl(path) {
  if (!path) {
    return API_URL;
  }

  // Already an absolute URL
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function api(path, options = {}) {
  const fetchOptions = {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : {
            "Content-Type": "application/json",
          }),
      ...(options.headers || {}),
    },
  };

  const url = buildUrl(path);

  console.log("AURA API REQUEST:", url);

  const response = await fetch(url, fetchOptions);

  const contentType =
    response.headers.get("content-type") || "";

  let body;

  if (contentType.includes("application/json")) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  if (!response.ok) {
    const message =
      typeof body === "object"
        ? body?.error || body?.message
        : body;

    throw new Error(
      message || `Request failed (${response.status})`
    );
  }

  return body;
}

export async function streamChat(
  path,
  payload,
  {
    signal,
    onMeta,
    onDelta,
    onDone,
    onError,
  } = {}
) {
  const url = buildUrl(path);

  console.log("AURA CHAT REQUEST:", url);

  const response = await fetch(url, {
    method: "POST",

    credentials: "include",

    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },

    body: JSON.stringify(payload),

    signal,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const contentType =
        response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const body = await response.json();

        message =
          body?.error ||
          body?.message ||
          message;
      } else {
        const text = await response.text();

        if (text.trim()) {
          message = text;
        }
      }
    } catch {
      // Keep default error message.
    }

    throw new Error(message);
  }

  if (!response.body) {
    throw new Error(
      "The server returned an empty response stream."
    );
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder("utf-8");

  let buffer = "";

  function processEvent(event) {
    if (!event || !event.trim()) {
      return;
    }

    let eventType = "message";

    const dataLines = [];

    for (const line of event.split("\n")) {
      if (line.startsWith("event:")) {
        eventType = line
          .slice("event:".length)
          .trim();
      }

      if (line.startsWith("data:")) {
        dataLines.push(
          line
            .slice("data:".length)
            .trim()
        );
      }
    }

    if (!dataLines.length) {
      return;
    }

    const rawData =
      dataLines.join("\n");

    if (!rawData) {
      return;
    }

    let parsed;

    try {
      parsed = JSON.parse(rawData);
    } catch {
      console.warn(
        "AURA: Invalid SSE JSON:",
        rawData
      );

      return;
    }

    switch (eventType) {
      case "meta":
        onMeta?.(parsed);
        break;

      case "delta":
        onDelta?.(parsed);
        break;

      case "done":
        onDone?.(parsed);
        break;

      case "error":
        onError?.(parsed);
        break;

      default:
        // Some SSE implementations don't send
        // an explicit event name.
        if (parsed?.text !== undefined) {
          onDelta?.(parsed);
        }
        break;
    }
  }

  try {
    while (true) {
      const {
        value,
        done,
      } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(
        value,
        {
          stream: true,
        }
      );

      // Normalize Windows line endings.
      buffer = buffer.replace(
        /\r\n/g,
        "\n"
      );

      // Handle SSE events.
      const events =
        buffer.split("\n\n");

      buffer =
        events.pop() || "";

      for (const event of events) {
        processEvent(event);
      }
    }

    // Flush decoder.
    buffer += decoder.decode();

    if (buffer.trim()) {
      // Process final event even if the server
      // didn't send the final double newline.
      processEvent(buffer);
    }
  } finally {
    reader.releaseLock();
  }
}

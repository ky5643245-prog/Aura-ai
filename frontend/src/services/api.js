export async function api(path, options = {}) {
  const fetchOptions = {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  };

  const response = await fetch(path, fetchOptions);

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
        ? body?.error
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
  const response = await fetch(path, {
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
      // Keep default error.
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

  const decoder = new TextDecoder("utf-8");

  let buffer = "";

  try {
    while (true) {
      const {
        value,
        done,
      } = await reader.read();

      if (done) break;

      buffer += decoder.decode(
        value,
        { stream: true }
      );

      // Normalize Windows line endings.
      buffer = buffer.replace(/\r\n/g, "\n");

      const events =
        buffer.split("\n\n");

      buffer =
        events.pop() || "";

      for (const event of events) {
        if (!event.trim()) continue;

        let eventType = "message";
        const dataLines = [];

        for (const line of event.split("\n")) {
          if (line.startsWith("event:")) {
            eventType =
              line
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
          continue;
        }

        const rawData =
          dataLines.join("\n");

        if (!rawData) continue;

        let parsed;

        try {
          parsed =
            JSON.parse(rawData);
        } catch {
          console.warn(
            "AURA: Invalid SSE JSON:",
            rawData
          );

          continue;
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
            // Some servers send unnamed messages.
            if (
              parsed?.text !== undefined
            ) {
              onDelta?.(parsed);
            }
            break;
        }
      }
    }

    // Flush decoder.
    buffer += decoder.decode();

    if (buffer.trim()) {
      const events =
        buffer.split("\n\n");

      for (const event of events) {
        if (!event.trim()) continue;

        let eventType = "message";
        const dataLines = [];

        for (const line of event.split("\n")) {
          if (line.startsWith("event:")) {
            eventType =
              line
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

        if (!dataLines.length) continue;

        try {
          const parsed =
            JSON.parse(
              dataLines.join("\n")
            );

          if (eventType === "meta") {
            onMeta?.(parsed);
          } else if (
            eventType === "delta"
          ) {
            onDelta?.(parsed);
          } else if (
            eventType === "done"
          ) {
            onDone?.(parsed);
          } else if (
            eventType === "error"
          ) {
            onError?.(parsed);
          }
        } catch {
          // Ignore incomplete/invalid trailing SSE data.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
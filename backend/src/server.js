import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import SQLiteStoreFactory from "connect-sqlite3";
import rateLimit from "express-rate-limit";

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// -------------------------------------------------------
// ROUTES
// -------------------------------------------------------

import authRoutes from "./routes/auth.js";
import conversationRoutes from "./routes/conversations.js";
import chatRoutes from "./routes/chat.js";
import fileRoutes from "./routes/files.js";
import settingsRoutes from "./routes/settings.js";

// -------------------------------------------------------
// MIDDLEWARE
// -------------------------------------------------------

import { requireAuth } from "./middleware/auth.js";
import { notFound, errorHandler } from "./middleware/errors.js";

// -------------------------------------------------------
// APP
// -------------------------------------------------------

const app = express();

// -------------------------------------------------------
// PATH CONFIGURATION
// -------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "..");

const dataDirectory = path.join(projectRoot, "data");

// Create data directory if it does not exist
fs.mkdirSync(dataDirectory, {
  recursive: true
});

// -------------------------------------------------------
// ENVIRONMENT
// -------------------------------------------------------

const isProd =
  process.env.NODE_ENV === "production";

const port = Number(
  process.env.PORT || 4000
);

const frontendOrigin =
  process.env.FRONTEND_ORIGIN ||
  "http://localhost:5173";

// -------------------------------------------------------
// SESSION SECRET
// -------------------------------------------------------

const sessionSecret =
  process.env.SESSION_SECRET ||
  (!isProd
    ? "development-only-change-me"
    : null);

if (isProd && !process.env.SESSION_SECRET) {
  console.error(
    "ERROR: SESSION_SECRET is missing."
  );

  process.exit(1);
}

// -------------------------------------------------------
// TRUST PROXY
// IMPORTANT FOR RENDER
// -------------------------------------------------------

if (isProd) {
  app.set("trust proxy", 1);
}

// -------------------------------------------------------
// BASIC APP CONFIG
// -------------------------------------------------------

app.disable("x-powered-by");

// -------------------------------------------------------
// SECURITY HEADERS
// -------------------------------------------------------

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
  })
);

// -------------------------------------------------------
// CORS
// -------------------------------------------------------

const allowedOrigins = frontendOrigin
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header
      // such as curl/server-side requests.
      if (!origin) {
        return callback(null, true);
      }

      // Allow configured frontend origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Development convenience
      if (
        !isProd &&
        origin === "http://localhost:5173"
      ) {
        return callback(null, true);
      }

      console.warn(
        `CORS blocked origin: ${origin}`
      );

      return callback(
        new Error("Not allowed by CORS")
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

// -------------------------------------------------------
// BODY PARSERS
// -------------------------------------------------------

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "100kb"
  })
);

// -------------------------------------------------------
// SESSION STORE
// -------------------------------------------------------

const SQLiteStore =
  SQLiteStoreFactory(session);

const sessionStore =
  new SQLiteStore({
    db: "sessions.sqlite",

    dir: dataDirectory
  });

// -------------------------------------------------------
// SESSION
// -------------------------------------------------------

app.use(
  session({
    store: sessionStore,

    secret: sessionSecret,

    resave: false,

    saveUninitialized: false,

    proxy: isProd,

    cookie: {
      httpOnly: true,

      sameSite: isProd
        ? "none"
        : "lax",

      secure: isProd,

      maxAge:
        1000 *
        60 *
        60 *
        24 *
        14
    }
  })
);

// -------------------------------------------------------
// REQUEST LOGGER
// -------------------------------------------------------

app.use(
  (req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration =
        Date.now() - start;

      console.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
      );
    });

    next();
  }
);

// -------------------------------------------------------
// ROOT ROUTE
// -------------------------------------------------------

app.get(
  "/",
  (req, res) => {
    res.status(200).json({
      ok: true,
      service: "AURA AI API",
      status: "online",
      environment:
        process.env.NODE_ENV ||
        "development",
      message:
        "AURA AI backend is running."
    });
  }
);

// -------------------------------------------------------
// HEALTH CHECK
// IMPORTANT:
// KEEP THIS BEFORE AUTH MIDDLEWARE
// -------------------------------------------------------

app.get(
  "/api/health",
  (req, res) => {
    res.status(200).json({
      ok: true,
      service: "AURA AI API",
      status: "online",
      timestamp: new Date().toISOString()
    });
  }
);

// -------------------------------------------------------
// AUTH RATE LIMITER
// -------------------------------------------------------

const authLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 30,

    standardHeaders: "draft-8",

    legacyHeaders: false,

    message: {
      ok: false,
      error:
        "Too many authentication requests. Please try again later."
    }
  });

// -------------------------------------------------------
// AUTH ROUTES
// PUBLIC
// -------------------------------------------------------

app.use(
  "/api/auth",
  authLimiter,
  authRoutes
);

// -------------------------------------------------------
// PROTECTED API RATE LIMITER
// -------------------------------------------------------

const protectedLimiter =
  rateLimit({
    windowMs: 60 * 1000,

    limit: 120,

    standardHeaders: "draft-8",

    legacyHeaders: false,

    message: {
      ok: false,
      error:
        "Too many requests. Please try again later."
    }
  });

// -------------------------------------------------------
// PROTECTED API
// -------------------------------------------------------

app.use(
  "/api",
  protectedLimiter
);

app.use(
  "/api",
  requireAuth
);

// -------------------------------------------------------
// CONVERSATIONS
// -------------------------------------------------------

app.use(
  "/api/conversations",
  conversationRoutes
);

// -------------------------------------------------------
// CHAT
// -------------------------------------------------------

app.use(
  "/api/chat",
  chatRoutes
);

// -------------------------------------------------------
// FILES
// -------------------------------------------------------

app.use(
  "/api/files",
  fileRoutes
);

// -------------------------------------------------------
// SETTINGS
// -------------------------------------------------------

app.use(
  "/api/settings",
  settingsRoutes
);

// -------------------------------------------------------
// 404
// -------------------------------------------------------

app.use(notFound);

// -------------------------------------------------------
// ERROR HANDLER
// -------------------------------------------------------

app.use(errorHandler);

// -------------------------------------------------------
// GLOBAL ERROR HANDLER
// -------------------------------------------------------

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "UNCAUGHT EXCEPTION:"
    );

    console.error(error);

    if (isProd) {
      process.exit(1);
    }
  }
);

process.on(
  "unhandledRejection",
  (error) => {
    console.error(
      "UNHANDLED REJECTION:"
    );

    console.error(error);
  }
);

// -------------------------------------------------------
// START SERVER
// -------------------------------------------------------

const server =
  app.listen(
    port,
    "0.0.0.0",
    () => {
      console.log("");
      console.log(
        "========================================"
      );
      console.log(
        "        AURA AI API SERVER"
      );
      console.log(
        "========================================"
      );

      console.log(
        `Environment : ${
          process.env.NODE_ENV ||
          "development"
        }`
      );

      console.log(
        `Port        : ${port}`
      );

      console.log(
        `Frontend    : ${frontendOrigin}`
      );

      console.log(
        `Data        : ${dataDirectory}`
      );

      console.log(
        `AI Mode     : ${
          process.env.AI_API_KEY &&
          process.env.AI_MODEL
            ? "LIVE"
            : "DEVELOPMENT"
        }`
      );

      console.log(
        "========================================"
      );

      console.log(
        `AURA AI API listening on port ${port}`
      );

      console.log("");
    }
  );

// -------------------------------------------------------
// GRACEFUL SHUTDOWN
// -------------------------------------------------------

const shutdown = (
  signal
) => {
  console.log(
    `${signal} received. Shutting down...`
  );

  server.close(
    () => {
      console.log(
        "HTTP server closed."
      );

      process.exit(0);
    }
  );

  setTimeout(
    () => {
      console.error(
        "Forced shutdown."
      );

      process.exit(1);
    },
    10000
  );
};

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);
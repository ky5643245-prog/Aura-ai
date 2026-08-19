import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import SQLiteStoreFactory from "connect-sqlite3";
import rateLimit from "express-rate-limit";
import path from "node:path";
import fs from "node:fs";

import authRoutes from "./routes/auth.js";
import conversationRoutes from "./routes/conversations.js";
import chatRoutes from "./routes/chat.js";
import fileRoutes from "./routes/files.js";
import settingsRoutes from "./routes/settings.js";

import { requireAuth } from "./middleware/auth.js";
import { notFound, errorHandler } from "./middleware/errors.js";

const app = express();

const port = Number(process.env.PORT || 4000);
const isProd = process.env.NODE_ENV === "production";

/* -------------------------------------------------------
   DATA DIRECTORY
------------------------------------------------------- */

fs.mkdirSync(path.resolve("data"), { recursive: true });

/* -------------------------------------------------------
   BASIC SECURITY
------------------------------------------------------- */

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
  })
);

/* -------------------------------------------------------
   CORS
------------------------------------------------------- */

app.use(
  cors({
    origin:
      process.env.FRONTEND_ORIGIN ||
      "http://localhost:5173",
    credentials: true
  })
);

/* -------------------------------------------------------
   BODY PARSERS
------------------------------------------------------- */

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

/* -------------------------------------------------------
   SESSION
------------------------------------------------------- */

const SQLiteStore = SQLiteStoreFactory(session);

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.sqlite",
      dir: path.resolve("data")
    }),

    secret:
      process.env.SESSION_SECRET ||
      "development-only-change-me",

    resave: false,

    saveUninitialized: false,

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

/* -------------------------------------------------------
   AUTH ROUTES
   These routes are public.
------------------------------------------------------- */

app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30
  }),
  authRoutes
);

/* -------------------------------------------------------
   PUBLIC HEALTH CHECK
   IMPORTANT:
   This MUST come before requireAuth.
------------------------------------------------------- */

app.get(
  "/api/health",
  (req, res) => {
    res.status(200).json({
      ok: true,
      service: "AURA AI API",
      status: "online"
    });
  }
);

/* -------------------------------------------------------
   PROTECTED API RATE LIMITER
------------------------------------------------------- */

const protectedLimiter = rateLimit({
  windowMs: 60 * 1000,

  limit: 120,

  standardHeaders: "draft-8",

  legacyHeaders: false
});

/* -------------------------------------------------------
   PROTECT PRIVATE API
------------------------------------------------------- */

app.use(
  "/api",
  protectedLimiter
);

app.use(
  "/api",
  requireAuth
);

/* -------------------------------------------------------
   PROTECTED ROUTES
------------------------------------------------------- */

app.use(
  "/api/conversations",
  conversationRoutes
);

app.use(
  "/api/chat",
  chatRoutes
);

app.use(
  "/api/files",
  fileRoutes
);

app.use(
  "/api/settings",
  settingsRoutes
);

/* -------------------------------------------------------
   404 HANDLER
------------------------------------------------------- */

app.use(notFound);

/* -------------------------------------------------------
   ERROR HANDLER
------------------------------------------------------- */

app.use(errorHandler);

/* -------------------------------------------------------
   START SERVER
------------------------------------------------------- */

app.listen(
  port,
  () => {
    console.log(
      `AURA AI API listening on http://localhost:${port}`
    );

    console.log(
      process.env.AI_API_KEY &&
      process.env.AI_MODEL
        ? "AI mode: live provider"
        : "AI mode: development provider"
    );

    console.log(
      `Environment: ${process.env.NODE_ENV || "development"}`
    );
  }
);
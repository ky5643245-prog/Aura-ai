# AURA AI — Production-Style AI Chat

A full-stack React + Vite + Express + SQLite AI chat application with:

- Real streaming responses via an OpenAI-compatible API
- Deterministic development/mock provider when no AI key is configured
- SQLite persistence for users, sessions, conversations, messages, settings and attachments
- Signup/login/logout with bcrypt password hashing and server-side sessions
- Markdown + GFM + syntax-highlighted code blocks
- Copy/regenerate/edit/resend/stop/retry/like/dislike
- Conversation search, pin, rename, duplicate, export and delete
- Safe file uploads for TXT/PDF/DOCX/CSV/JSON/images
- Responsive mobile drawer
- Settings, accessibility, rate limiting, Helmet, CORS and input validation

## Requirements

- Node.js 20+
- npm 10+

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

The API starts on `http://localhost:4000`.

If `AI_API_KEY` is empty, the server automatically uses **Development Mode** with a deterministic local provider. No fake "real AI" claim is made in the UI.

For a real model, set:

```env
AI_API_KEY=your_key
AI_MODEL=your_model
AI_BASE_URL=https://api.openai.com/v1
```

Any OpenAI-compatible provider can be used by changing `AI_BASE_URL`, `AI_MODEL`, and `AI_API_KEY`.

### 2. Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown by the terminal, normally `http://localhost:5173`.

## Production build

```bash
cd frontend
npm run build
```

Then serve `frontend/dist` from your production web server and proxy `/api` to the backend.

For production, use HTTPS, a persistent secret, a real reverse proxy, restricted CORS origin, and a production-grade session/database backup strategy.

## Project structure

```text
ai-assistant/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── store/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── database/
│   │   └── server.js
│   ├── .env.example
│   └── package.json
└── README.md
```

## API

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `DELETE /api/auth/account`
- `GET /api/auth/me`
- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:id`
- `PATCH /api/conversations/:id`
- `DELETE /api/conversations/:id`
- `POST /api/conversations/:id/duplicate`
- `GET /api/conversations/:id/export`
- `POST /api/chat`
- `POST /api/chat/regenerate`
- `POST /api/chat/edit`
- `POST /api/files`
- `GET /api/settings`
- `PATCH /api/settings`

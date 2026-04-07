# EduLens v2 — AI-Powered Education Platform

## Setup & Deployment (Netlify)

### 1. Clone & Install
```bash
npm install
```

### 2. Firebase Setup
Copy `.env.example` to `.env` and fill in your Firebase config (already embedded in `firebase.ts`).

Set Firestore rules from `firestore.rules`. Enable Firebase Storage in your project.

### 3. Deploy on Netlify
Push to GitHub, connect to Netlify, then add this **environment variable** in Netlify's site settings:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your key from console.anthropic.com |

Netlify auto-detects `netlify.toml` — build command is `npm run build`, publish dir is `dist`.

### 4. First Run
1. Log in as teacher (`teacher@edulens.com` / `teach123`)
2. Click **"Seed Demo Data"** on the dashboard to populate 12 students + attendance + assignments
3. Student login: `student@edulens.com` / `student123`

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + Firebase SDK
- **AI Proxy**: `netlify/functions/claude.js` — server-side proxy for Anthropic API (avoids CORS)
- **Database**: Firebase Firestore + Firebase Storage

## Bugs Fixed in This Version
- ✅ `require()` crash in AttendanceTab → replaced with static ESM import
- ✅ Firestore composite index crash in student attendance → client-side sort instead
- ✅ CORS crash on Anthropic API calls → Netlify serverless function proxy
- ✅ Student assignments not loading → fixed student Firestore ID lookup
- ✅ Missing `studentName` field in AttendanceRecord type
- ✅ File upload handlers used wrong event type (FormEvent vs click)
- ✅ Error handlers added to all Firebase snapshot listeners

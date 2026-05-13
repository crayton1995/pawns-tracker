# Pawns Replays — Setup Guide

## Step 1: Set up the Supabase database (do this first)

1. Go to https://supabase.com/dashboard/project/vvlyxhnmigrpgwnigyke
2. Click **SQL Editor** in the left sidebar
3. Click **+ New query**
4. Open the file `supabase/schema.sql` from this folder and paste ALL of it into the editor
5. Click **Run** (or press Ctrl+Enter)
6. You should see "Success. No rows returned" — that means it worked

### Make yourself admin
1. In Supabase, go to **Authentication → Users**
2. Find your user, copy the UUID
3. Go back to SQL Editor and run:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE id = '<paste-your-uuid-here>';
   ```

---

## Step 2: Load the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this project
5. The Pawns Replays extension will appear — pin it to your toolbar

---

## Step 3: Deploy the Web App to Vercel

### One-time setup
1. Install Node.js if you don't have it: https://nodejs.org
2. Open a terminal in the `webapp/` folder
3. Run: `npm install`
4. Run: `npm run dev` — this starts a local preview at http://localhost:5173

### Deploy to Vercel (free)
1. Push the `webapp/` folder to a GitHub repo
2. Go to https://vercel.com and connect your GitHub
3. Import the repo, set the root directory to `webapp/`
4. Click Deploy — done. Vercel gives you a free URL like `pawns-replays.vercel.app`
5. Update the `WEBAPP_URL` in `extension/popup/popup.js` with your real Vercel URL

---

## Step 4: Create accounts for your players

1. Log into the Pawns Replays web app as admin
2. Go to https://supabase.com/dashboard/project/vvlyxhnmigrpgwnigyke/auth/users
3. Click **Invite user** → enter their email
4. They'll get an email to set their password
5. They log into the Chrome extension popup with those credentials
6. Their games automatically save from that point on

---

## How recording works

1. Player logs into the extension popup
2. Player opens karabast.net and starts a game
3. The extension automatically detects the game start and begins recording
4. Every game action (card plays, attacks, passes, etc.) is captured
5. When the game ends, the full replay is uploaded to Supabase
6. Player sees it instantly in their Replays list

---

## File structure

```
star wars extension/
├── extension/              ← Chrome extension (load this in chrome://extensions)
│   ├── manifest.json
│   ├── background.js       ← handles auth + Supabase API calls
│   ├── content.js          ← runs on karabast.net, collects game actions
│   ├── injected.js         ← intercepts WebSocket messages from the game
│   └── popup/              ← the extension popup UI
│       ├── popup.html
│       ├── popup.js
│       └── popup.css
├── webapp/                 ← React web app (deploy to Vercel)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Replays.jsx       ← replay list
│   │   │   ├── ReplayViewer.jsx  ← step-through viewer + comments
│   │   │   └── ShareViewer.jsx   ← public share page (no login)
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   └── Comments.jsx      ← real-time comment threads
│   │   └── lib/supabase.js
│   └── package.json
└── supabase/
    └── schema.sql              ← paste this into Supabase SQL Editor
```

# Pawns Replays — Full Build Plan
**Star Wars Unlimited Replay System for Karabast.net**

---

## What You're Building

A system with three interconnected pieces:
1. **Chrome Extension** — records every game action on Karabast automatically
2. **Web App** — browse, watch, annotate, and comment on replays (hosted in the cloud)
3. **Backend** — stores replays, authenticates users, enforces access control

---

## Recommended Tech Stack (and why)

### ✅ Backend: Supabase (Free Tier)
Instead of running your own server ("local code"), use Supabase — a hosted Postgres database with built-in auth, file storage, and real-time subscriptions. It replaces a custom Node/Express server entirely and is free for your use case.

**Why Supabase over a custom server:**
- Auth (email/password, invite-only users) is built in — no code to write
- Row-level security: users can only see their own replays by default
- File storage for replay JSON files with auto-generated public URLs
- Real-time subscriptions = live comment updates with no extra infrastructure
- Free tier: 500MB DB, 1GB storage, 50k monthly active users
- Dashboard to manage users, view data, and run queries

### ✅ Frontend: React + Vercel (Free Tier)
A React app deployed to Vercel. Every push to GitHub auto-deploys. Free custom domain support.

### ✅ Chrome Extension: Manifest V3
The extension is the only piece that runs locally (in the user's browser). It uses a content script to hook into Karabast's game state and sends replay data to Supabase.

---

## Database Schema

```sql
-- Users (managed by Supabase Auth, extended with this table)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'player', -- 'player' | 'admin'
  invited_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Replays
CREATE TABLE replays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID REFERENCES profiles(id),
  player2_id UUID REFERENCES profiles(id), -- nullable if opponent not registered
  player1_username TEXT NOT NULL,
  player2_username TEXT NOT NULL,
  player1_leader TEXT,
  player2_leader TEXT,
  player1_deck TEXT,
  player2_deck TEXT,
  winner_username TEXT,
  game_format TEXT, -- 'Premier Best-of-One', 'Premier Best-of-Three', etc.
  actions JSONB NOT NULL, -- full game action log
  storage_path TEXT, -- path in Supabase Storage for large replays
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(12), 'base64'),
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  replay_id UUID REFERENCES replays(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id),
  parent_id UUID REFERENCES comments(id), -- for threaded replies
  body TEXT NOT NULL,
  action_index INT, -- links comment to a specific moment in the replay
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collections (group replays into a series or tournament)
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE collection_replays (
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  replay_id UUID REFERENCES replays(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_id, replay_id)
);
```

### Row-Level Security Policies
- Players can only INSERT replays where they are player1_id
- Players can only READ their own replays (or public ones, or ones shared via token)
- Comments are readable by anyone with access to the replay
- Admins bypass all restrictions

---

## Chrome Extension Architecture

### Files
```
extension/
├── manifest.json          # MV3 config, permissions, content scripts
├── background.js          # Service worker — handles auth token, API calls
├── content.js             # Injected into karabast.net — records game
├── popup/
│   ├── popup.html
│   ├── popup.js           # Shows recording status, logged-in user
│   └── popup.css
└── icons/
    └── icon-*.png
```

### How Recording Works

Karabast is an open-source app (React frontend). The content script:
1. Monitors the DOM and Karabast's internal WebSocket for game state changes
2. Detects game start (when a game ID appears in the URL or DOM)
3. Hooks into `window.__KARABAST_STATE__` or intercepts WebSocket messages to capture every action (play card, attack, pass, etc.)
4. Timestamps and serializes each action into a JSON array
5. On game end, sends the full action log to Supabase via the background service worker

### Auth Flow
- User logs in via the extension popup (email + password → Supabase Auth)
- JWT stored in `chrome.storage.local`
- Every API call includes the JWT in the `Authorization` header
- If no token, popup shows "Connect to Pawns Replays" button

---

## User Authentication (Invite-Only System)

### How It Works
1. **You (admin)** log into the web app admin panel
2. Enter a new player's email → system generates a one-time invite link via Supabase Auth
3. Player receives email, clicks link, sets their password
4. Player installs Chrome extension, logs in with those credentials
5. All their replays are now associated with their account

### Security
- Signups are disabled publicly — only admin can create users via invite
- Row-level security ensures players can't access each other's private replays
- Share tokens allow sharing specific replays with non-users via a link

---

## Web App Pages

### 1. My Replays (`/replays`)
- Table of all your games: date, opponent, leaders, decks, win/loss
- Filter by leader, deck, date range, opponent
- Sort by date or win rate
- Quick actions: view, share, delete, add to collection

### 2. Replay Viewer (`/replays/:id`)
- Step-by-step action log (forward/back controls)
- Visual representation of each action (card played, unit attacked, etc.)
- Timeline scrubber
- Comment thread on the right — anchored to specific action steps
- Share button generates a public link (`/share/:token`)

### 3. Player Profile (`/players/:username`)
- Visible to other logged-in users
- Stats: win rate, most-played leaders, favorite decks
- Public replays list

### 4. Collections (`/collections`)
- Create a named group of replays (e.g., "Tuesday Night Games", "Tournament Set 1")
- Can be public or private
- Each collection has a scoreboard tab

### 5. Scoreboards (`/scoreboards`)
- Head-to-head records between players
- Leader matchup win rates
- Most-played leaders

### 6. Admin (`/admin`)
- Invite users (enter email → sends invite)
- Revoke user access
- View all replays across all users
- Delete content

---

## Shareable Links

Each replay gets a `share_token` (random 16-char string) on creation.

- Private replay: only owner + users they share with can access
- Shared link: `yourapp.vercel.app/share/abc123def456` — works for anyone, no login required
- Public replay: listed on player's public profile

---

## Hosting Summary

| Piece | Service | Cost |
|---|---|---|
| Database + Auth + Storage | Supabase | **Free** |
| Web App | Vercel | **Free** |
| Chrome Extension | Chrome Web Store (optional) | $5 one-time dev fee |
| Custom Domain (optional) | Namecheap / Cloudflare | ~$10/yr |

**Total: $0/month**, optionally $5 one-time to publish to Chrome Web Store (or just distribute the extension file directly to your players).

---

## Local Code vs. Cloud (Your Question)

You asked about this directly. Here's the honest comparison:

**Local code (running your own server):**
- You'd need a VPS (Digital Ocean ~$6/mo, Railway ~$5/mo, etc.)
- You manage auth, database, storage, SSL certs, backups yourself
- More control but much more to set up and maintain

**Supabase + Vercel (recommended):**
- Zero server management — both handle infra for you
- Auth, storage, and real-time are built in and free
- Scales automatically if usage grows
- Still fully open source — you can migrate later if needed

**Verdict: Use Supabase + Vercel.** For a project this size (a group of players), you won't hit the free tier limits. If you ever outgrow it, migrating to a custom backend is straightforward because Supabase uses standard Postgres.

---

## Build Order (Phases)

### Phase 1 — Core Loop (2–3 weeks)
1. Set up Supabase project (5 min — just click through the dashboard)
2. Create database tables + RLS policies
3. Build Chrome extension: content script hooks into Karabast, records actions, popup shows status
4. Build basic web app: login page + replay list page + replay viewer

### Phase 2 — Users & Sharing (1 week)
5. Admin invite flow (Supabase Auth invites via dashboard or API)
6. Per-user replay organization
7. Shareable links

### Phase 3 — Social Features (1 week)
8. Comments with action-index anchoring
9. Activity feed (recent comments across your replays)
10. Player profiles + head-to-head stats

### Phase 4 — Polish (ongoing)
11. Collections / grouping
12. Scoreboards
13. Better replay viewer (visual board state vs. just action log)
14. Chrome Web Store submission

---

## Next Steps

1. **Create a free Supabase account** at supabase.com
2. **Create a free Vercel account** at vercel.com (connect to GitHub)
3. Tell me which phase you want to start building first and I'll generate all the code

---

*Built for Karabast.net — Fan-made Star Wars Unlimited simulator*

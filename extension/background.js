/**
 * background.js — Pawns Replays Service Worker
 *
 * Handles auth token storage and saving replays to Supabase.
 * Runs as a Manifest V3 service worker.
 */

const SUPABASE_URL  = 'https://vvlyxhnmigrpgwnigyke.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2bHl4aG5taWdycGd3bmlneWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NTIzMTMsImV4cCI6MjA5NDEyODMxM30.Wxn8Yfdvu83h5HWcaScSfq_3ClTXsAEfrqvcy9r8wDs';

// ─── Auth Helpers ──────────────────────────────────────────────

async function getSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['pawns_session'], (result) => {
      resolve(result.pawns_session || null);
    });
  });
}

async function refreshSession(session) {
  if (!session?.refresh_token) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body:    JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;
    await setSession(data);
    return data;
  } catch {
    return null;
  }
}

// Returns a valid session, refreshing the token if it expires within 60 seconds.
async function getValidSession() {
  const session = await getSession();
  if (!session) return null;
  const expiresAt = session.expires_at; // unix seconds from Supabase
  if (expiresAt && Date.now() / 1000 > expiresAt - 60) {
    return await refreshSession(session);
  }
  return session;
}

async function setSession(session) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ pawns_session: session }, resolve);
  });
}

async function clearSession() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['pawns_session'], resolve);
  });
}

async function getAuthHeaders() {
  const session = await getValidSession();
  const token = session?.access_token || SUPABASE_ANON;
  return {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_ANON,
    'Authorization': `Bearer ${token}`,
  };
}

// ─── Supabase API Calls ────────────────────────────────────────

async function supabasePost(path, body) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method:  'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase POST failed (${res.status}): ${err}`);
  }
  return res.json();
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey':       SUPABASE_ANON,
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.message || 'Login failed');
  return data;
}

async function signOut() {
  const session = await getSession();
  if (!session) return;
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method:  'POST',
    headers: {
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${session.access_token}`,
    },
  });
  await clearSession();
}

async function getProfile(userId) {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`,
    { headers }
  );
  const data = await res.json();
  return data?.[0] || null;
}

// ─── Save Replay ────────────────────────────────────────────────

async function saveReplay(game) {
  console.log('[Pawns Replays BG] Saving replay to Supabase...');
  console.log('[Pawns Replays BG]   Game ID:', game.gameId);
  console.log('[Pawns Replays BG]   Actions:', game.actions?.length);

  const session = await getValidSession();
  if (!session?.user) throw new Error('Not logged in — session expired, please sign in again');

  // Try to get profile, fall back to session data if not found
  let profile = await getProfile(session.user.id);
  if (!profile) {
    console.log('[Pawns Replays BG] Profile not in DB — creating from session data');
    const fallbackUsername = session.user.email?.split('@')[0] || 'player';
    // Try to insert the profile row automatically
    try {
      const headers = await getAuthHeaders();
      await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method:  'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body:    JSON.stringify({
          id:           session.user.id,
          username:     fallbackUsername,
          display_name: fallbackUsername,
          role:         'player',
        }),
      });
      profile = await getProfile(session.user.id);
    } catch (e) {
      console.warn('[Pawns Replays BG] Could not create profile:', e.message);
    }
    // Last resort fallback
    if (!profile) {
      profile = { id: session.user.id, username: fallbackUsername };
    }
  }

  console.log('[Pawns Replays BG]   Saving as user:', profile.username);

  const replayRow = {
    player1_id:        session.user.id,
    player1_username:  game.player1?.username || profile.username,
    player1_leader:    game.player1?.leader   || null,
    player1_base:      game.player1?.base     || null,
    player1_deck_name: game.player1?.deckName || null,
    player2_id:        null,
    player2_username:  game.player2?.username || 'Unknown',
    player2_leader:    game.player2?.leader   || null,
    player2_base:      game.player2?.base     || null,
    player2_deck_name: game.player2?.deckName || null,
    winner_username:   game.winner            || null,
    game_format:       game.format            || null,
    actions:           game.actions           || [],
    game_id:           game.gameId            || null,
    is_public:         true,
  };

  const [saved] = await supabasePost('replays', replayRow);
  console.log('[Pawns Replays BG] ✅ Saved! Replay ID:', saved.id);
  return saved;
}

// ─── Message Handler ────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, payload } = message;

  if (type === 'SAVE_REPLAY') {
    saveReplay(payload)
      .then((saved) => sendResponse({ success: true, replayId: saved.id }))
      .catch((err)  => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }

  if (type === 'SIGN_IN') {
    const { email, password } = payload;
    signIn(email, password)
      .then(async (session) => {
        await setSession(session);
        const profile = await getProfile(session.user.id);
        sendResponse({ success: true, session, profile });
      })
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (type === 'SIGN_OUT') {
    signOut()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (type === 'GET_SESSION') {
    getValidSession().then(async (session) => {
      if (!session) return sendResponse({ session: null, profile: null });
      const profile = await getProfile(session.user.id);
      sendResponse({ session, profile });
    });
    return true;
  }

  // Status updates from content.js — relay to popup if open
  if (type === 'STATUS_UPDATE') {
    chrome.storage.local.set({ pawns_status: payload });
    // Broadcast to any open popup
    chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', payload }).catch(() => {});
    return false;
  }
});

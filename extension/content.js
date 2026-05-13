/**
 * content.js — Pawns Replays
 *
 * Runs in the Karabast page. Injects the WebSocket interceptor,
 * collects game actions, and forwards completed games to background.js.
 */

'use strict';

// ─── State ─────────────────────────────────────────────────────
let currentGame = null;   // { meta, actions[] }
let isRecording = false;

// ─── Listen for messages from injected.js ──────────────────────
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== 'pawns-injected') return;

  const { type, payload } = event.data;

  switch (type) {
    case 'INJECTED':
      console.log('[Pawns Replays] WebSocket interceptor active');
      notifyPopup({ status: 'connected' });
      break;

    case 'GAME_START':
      startGame(payload);
      break;

    case 'GAME_ACTION':
      recordAction(payload);
      break;

    case 'GAME_END':
      endGame(payload);
      break;
  }
});

function startGame(meta) {
  // Ignore if already recording this exact game
  if (currentGame?.gameId === meta.gameId) return;
  // Ignore if currently uploading a finished game
  if (!isRecording && currentGame) return;

  currentGame = {
    gameId:    meta.gameId,
    player1:   meta.player1,
    player2:   meta.player2,
    format:    meta.format,
    startedAt: meta.timestamp,
    actions:   [],
  };
  isRecording = true;

  console.log('%c[Pawns Replays] 🎮 GAME STARTED', 'color: #4ade80; font-weight: bold');
  console.log('  Game ID:', meta.gameId);
  console.log('  Player 1:', meta.player1?.username, '| Leader:', meta.player1?.leader);
  console.log('  Player 2:', meta.player2?.username, '| Leader:', meta.player2?.leader);
  console.log('  Format:', meta.format);
  notifyPopup({ status: 'recording', gameId: meta.gameId, meta });
}

function recordAction(payload) {
  if (!isRecording || !currentGame) return;
  if (currentGame.gameId && payload.gameId && currentGame.gameId !== payload.gameId) return;

  currentGame.actions.push({
    t:     payload.timestamp,
    event: payload.event,
    data:  payload.data,
  });

  // Log every 10 actions so you can see it's working without spam
  if (currentGame.actions.length % 10 === 0) {
    console.log(`%c[Pawns Replays] 📼 Recording... ${currentGame.actions.length} events captured`, 'color: #60a5fa');
  }
}

function endGame(payload) {
  if (!isRecording || !currentGame) return;

  currentGame.winner  = payload.winner;
  currentGame.endedAt = payload.timestamp;
  isRecording = false;

  const durationSecs = Math.round((payload.timestamp - currentGame.startedAt) / 1000);

  console.log('%c[Pawns Replays] 🏁 GAME ENDED', 'color: #f59e0b; font-weight: bold');
  console.log('  Winner:', currentGame.winner || 'Unknown');
  console.log('  Total events recorded:', currentGame.actions.length);
  console.log('  Game duration:', durationSecs, 'seconds');
  console.log('  Uploading to Supabase...');

  notifyPopup({ status: 'uploading' });

  try {
    chrome.runtime.sendMessage({
      type:    'SAVE_REPLAY',
      payload: { ...currentGame },
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Pawns Replays] Save failed:', chrome.runtime.lastError.message);
        console.error('  → If you just reloaded the extension, refresh this tab and play again.');
        currentGame = null;
        return;
      }
      if (response?.success) {
        console.log('%c[Pawns Replays] ✅ REPLAY SAVED', 'color: #4ade80; font-weight: bold');
        console.log('  Replay ID:', response.replayId);
        console.log('  View at: https://pawns-replays.vercel.app/replays/' + response.replayId);
        notifyPopup({ status: 'saved', replayId: response.replayId });
      } else {
        console.error('%c[Pawns Replays] ❌ SAVE FAILED', 'color: #f87171; font-weight: bold');
        console.error('  Error:', response?.error);
        notifyPopup({ status: 'error', error: response?.error });
      }
      currentGame = null;
    });
  } catch (err) {
    console.error('[Pawns Replays] Cannot reach background script:', err.message);
    console.error('  → Reload the extension and refresh this tab. The recorded game was lost.');
    currentGame = null;
  }
}

function notifyPopup(data) {
  // chrome.runtime.sendMessage can throw synchronously when the extension
  // has been reloaded while this tab stayed open ("Extension context
  // invalidated"). Wrap both the call and the returned promise.
  try {
    const result = chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', payload: data });
    if (result && typeof result.catch === 'function') {
      result.catch(() => { /* popup not open — fine */ });
    }
  } catch (_) {
    // Extension was reloaded; this tab needs a refresh. Stay quiet.
  }
}

// ─── Handle messages from popup.js ─────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_STATUS') {
    sendResponse({
      isRecording,
      gameId: currentGame?.gameId || null,
      actionCount: currentGame?.actions?.length || 0,
    });
  }
  return true;
});

/**
 * injected.js — Pawns Replays
 *
 * This script is injected INTO the Karabast page context (not the extension
 * context), so it can intercept Socket.io messages directly.
 *
 * Strategy: wrap the native WebSocket constructor so we can read every
 * message the server sends to the game client. We forward relevant game
 * events to content.js via window.postMessage.
 */

(function () {
  'use strict';

  const NativeWebSocket = window.WebSocket;

  // Track active game state
  let currentGameId       = null;
  let gameStarted         = false;
  let lastGameState       = null; // most recent gamestate snapshot
  let recentlyEndedIds    = [];   // game IDs we've already finalized — block restart
  let debuggedCardShape   = false; // log card object shape once per session

  function parseSocketIOMessage(rawData) {
    // Socket.IO frames start with a numeric code:
    // 0 = open, 1 = close, 2 = ping, 3 = pong, 4x = message
    // "42" prefix means event message: ["eventName", data]
    // "430" prefix means ack message
    try {
      if (typeof rawData !== 'string') return null;
      if (!rawData.startsWith('42')) return null;

      // Strip the "42" prefix and optional ack id digits
      const jsonStart = rawData.indexOf('[');
      if (jsonStart === -1) return null;

      const parsed = JSON.parse(rawData.slice(jsonStart));
      if (!Array.isArray(parsed) || parsed.length < 2) return null;

      return { event: parsed[0], data: parsed[1] };
    } catch {
      return null;
    }
  }

  function extractGameMeta(data) {
    // Karabast sends game state with player info — extract what we need
    // The shape may vary; we handle multiple known patterns
    try {
      const state = data?.gameState || data?.state || data;
      if (!state) return null;

      const players = state.players || [];
      if (players.length < 2) return null;

      return {
        gameId: state.id || state.gameId || currentGameId,
        player1: {
          username: players[0]?.name || players[0]?.username || 'Unknown',
          leader: players[0]?.leader?.internalName || players[0]?.leader?.title || null,
          base: players[0]?.base?.internalName || players[0]?.base?.title || null,
          deckName: players[0]?.deckName || null,
        },
        player2: {
          username: players[1]?.name || players[1]?.username || 'Unknown',
          leader: players[1]?.leader?.internalName || players[1]?.leader?.title || null,
          base: players[1]?.base?.internalName || players[1]?.base?.title || null,
          deckName: players[1]?.deckName || null,
        },
        format: state.format || null,
      };
    } catch {
      return null;
    }
  }

  // Pull a human-readable identifier from a card object (leader / base).
  // The card has shape: { id, setId: { set, number, ... }, controllerId, ... }
  // We try a chain of fallbacks so we get *something* useful even if the
  // schema shifts slightly between Karabast versions.
  function extractCardName(card) {
    if (!card || typeof card !== 'object') return null;
    // Direct name fields (in case Karabast ever attaches them at top level)
    if (card.name)         return card.name;
    if (card.title)        return card.title;
    if (card.internalName) return card.internalName;
    // setId is the canonical card reference. Shape is usually:
    //   { set: "SOR", number: "028" }   or   { id: "SOR_028" }   or similar
    const sid = card.setId;
    if (sid && typeof sid === 'object') {
      if (sid.internalName) return sid.internalName;
      if (sid.name)         return sid.name;
      if (sid.title)        return sid.title;
      if (sid.set && sid.number != null) return `${sid.set}_${sid.number}`;
      if (sid.id)           return String(sid.id);
    } else if (typeof sid === 'string') {
      return sid;
    }
    // Last resort — the numeric card id (not pretty but at least non-null)
    if (card.id) return String(card.id);
    return null;
  }

  // Events we care about recording
  const GAME_EVENTS = new Set([
    'lobbystate',
    'gamestate',
    'action',
  ]);

  function endCurrentGame(winner, data, timestamp) {
    if (!gameStarted) return;
    console.log('[Pawns Replays] Game over! Winner:', winner);
    const endedId = currentGameId;
    window.postMessage({
      source:  'pawns-injected',
      type:    'GAME_END',
      payload: { winner, data, timestamp, gameId: endedId },
    }, '*');
    currentGameId = null;
    gameStarted   = false;
    lastGameState = null;
    // Remember the last few finalized IDs so trailing gamestate frames
    // from Karabast don't kick off a duplicate GAME_START.
    if (endedId) {
      recentlyEndedIds.push(endedId);
      if (recentlyEndedIds.length > 5) recentlyEndedIds.shift();
    }
  }

  function handleIncomingMessage(event, data) {
    const timestamp = Date.now();

    // ── gamestate: fires on the game board page ──────────────
    if (event === 'gamestate' && data?.id) {

      // Block re-starting a game we just finalized. Karabast often sends a
      // few trailing gamestate frames after statsSubmitNotification, which
      // would otherwise re-trigger GAME_START with the same gameId.
      if (!gameStarted && recentlyEndedIds.includes(data.id)) {
        return;
      }

      // Start recording on the first gamestate we receive
      if (!gameStarted) {
        const players = data.players ? Object.values(data.players) : [];
        const p1      = players[0] || {};
        const p2      = players[1] || {};

        // One-time debug: print the actual card object shape so we can verify
        // setId structure across Karabast versions. Remove once schema stable.
        if (!debuggedCardShape && p1.leader) {
          debuggedCardShape = true;
          console.log('[Pawns Replays] DEBUG leader shape:', JSON.parse(JSON.stringify(p1.leader)));
          console.log('[Pawns Replays] DEBUG base shape:',   JSON.parse(JSON.stringify(p1.base)));
        }

        currentGameId = data.id;
        gameStarted   = true;

        const meta = {
          gameId:  data.id,
          format:  data.gameMode || data.gameFormat || data.format || null,
          player1: {
            username: p1.name || p1.username || p1.user?.username || 'Unknown',
            leader:   extractCardName(p1.leader),
            base:     extractCardName(p1.base),
            deckName: p1.deckName || null,
          },
          player2: {
            username: p2.name || p2.username || p2.user?.username || 'Unknown',
            leader:   extractCardName(p2.leader),
            base:     extractCardName(p2.base),
            deckName: p2.deckName || null,
          },
        };

        console.log('[Pawns Replays] Game started!', meta);
        window.postMessage({
          source:  'pawns-injected',
          type:    'GAME_START',
          payload: { ...meta, timestamp },
        }, '*');
      }

      // Record every board state update and keep a reference to the latest
      lastGameState = data;
      window.postMessage({
        source:  'pawns-injected',
        type:    'GAME_ACTION',
        payload: { event, data, timestamp, gameId: currentGameId },
      }, '*');

      // ── Detect game over via winners array (immediate) ──────
      const winners = data.winners || [];
      if (winners.length > 0 && gameStarted) {
        endCurrentGame(winners[0], data, timestamp);
      }
    }

    // ── statsSubmitNotification: reliable game-over signal ───
    if (event === 'statsSubmitNotification' && gameStarted) {
      console.log('[Pawns Replays] statsSubmitNotification received — ending game');

      // Try to find winner from last known gamestate
      let winner = null;
      if (lastGameState) {
        const winners    = lastGameState.winners || [];
        const playerList = lastGameState.players ? Object.values(lastGameState.players) : [];
        winner = winners[0] || playerList.find(p => p.winner)?.username || null;
      }

      endCurrentGame(winner, lastGameState, timestamp);
    }
  }

  // ─── WebSocket Proxy ────────────────────────────────────────
  class PawnsWebSocket extends NativeWebSocket {
    constructor(url, protocols) {
      super(url, protocols);

      console.log('[Pawns Replays] WebSocket connection:', url);

      this.addEventListener('message', (event) => {
        // Log ALL raw messages so we can see what Karabast sends
        if (typeof event.data === 'string' && event.data.length < 2000) {
          console.log('[Pawns Replays] WS message:', event.data);
        }

        const parsed = parseSocketIOMessage(event.data);
        if (parsed) {
          console.log('[Pawns Replays] Parsed event:', parsed.event, parsed.data);
          handleIncomingMessage(parsed.event, parsed.data);
        }
      });
    }
  }

  // Copy static properties
  Object.defineProperties(PawnsWebSocket, {
    CONNECTING: { value: NativeWebSocket.CONNECTING },
    OPEN:       { value: NativeWebSocket.OPEN },
    CLOSING:    { value: NativeWebSocket.CLOSING },
    CLOSED:     { value: NativeWebSocket.CLOSED },
  });

  window.WebSocket = PawnsWebSocket;

  // Signal to content.js that injection succeeded
  window.postMessage({ source: 'pawns-injected', type: 'INJECTED' }, '*');
})();

/**
 * popup.js — Pawns Replays
 * Handles login, logout, and live recording status display.
 */

'use strict';

const WEBAPP_URL = 'https://pawns-replays.vercel.app';

// ─── Elements ───────────────────────────────────────────────────
const viewLogin  = document.getElementById('view-login');
const viewMain   = document.getElementById('view-main');
const loginForm  = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginBtn   = document.getElementById('login-btn');
const logoutBtn  = document.getElementById('logout-btn');
const usernameEl = document.getElementById('username-display');
const statusBox  = document.getElementById('status-box');
const statusText = document.getElementById('status-text');
const gameInfo   = document.getElementById('game-info');
const gameIdVal  = document.getElementById('game-id-val');
const actionCount = document.getElementById('action-count');
const lastSaved  = document.getElementById('last-saved');
const viewReplayLink = document.getElementById('view-replay-link');

// ─── Init ────────────────────────────────────────────────────────
async function init() {
  const { session, profile } = await sendMessage('GET_SESSION', {});

  if (session) {
    // Use profile if we got it, otherwise fall back to email
    const displayProfile = profile || {
      username:     session.user?.email?.split('@')[0] || 'Player',
      display_name: session.user?.email?.split('@')[0] || 'Player',
    };
    showMain(displayProfile);
    loadCurrentStatus();
  } else {
    showLogin();
  }
}

// ─── Views ───────────────────────────────────────────────────────
function showLogin() {
  viewLogin.classList.remove('hidden');
  viewMain.classList.add('hidden');
}

function showMain(profile) {
  viewLogin.classList.add('hidden');
  viewMain.classList.remove('hidden');
  usernameEl.textContent = profile.display_name || profile.username;
}

// ─── Status ──────────────────────────────────────────────────────
function setStatus(state, text) {
  statusBox.className = `status ${state}`;
  statusText.textContent = text;
}

function loadCurrentStatus() {
  // Ask active Karabast tab for current state
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url?.includes('karabast')) {
      setStatus('idle', 'Open Karabast to start recording');
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, (resp) => {
      if (chrome.runtime.lastError || !resp) {
        setStatus('connected', 'Connected — waiting for a game');
        return;
      }
      if (resp.isRecording) {
        setStatus('recording', 'Recording game...');
        gameInfo.classList.remove('hidden');
        gameIdVal.textContent = resp.gameId || '—';
        actionCount.textContent = resp.actionCount || 0;
      } else {
        setStatus('connected', 'Connected — waiting for a game');
      }
    });
  });
}

// ─── Listen for live status updates from background ─────────────
chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'STATUS_UPDATE') return;
  const { payload } = message;

  switch (payload.status) {
    case 'connected':
      setStatus('connected', 'Connected to Karabast');
      gameInfo.classList.add('hidden');
      break;

    case 'recording':
      setStatus('recording', 'Recording game...');
      gameInfo.classList.remove('hidden');
      gameIdVal.textContent = payload.gameId || '—';
      actionCount.textContent = 0;
      lastSaved.classList.add('hidden');
      break;

    case 'uploading':
      setStatus('uploading', 'Saving replay...');
      break;

    case 'saved':
      setStatus('saved', 'Replay saved!');
      gameInfo.classList.add('hidden');
      lastSaved.classList.remove('hidden');
      viewReplayLink.href = `${WEBAPP_URL}/replays/${payload.replayId}`;
      // Reset to idle after 4s
      setTimeout(() => {
        setStatus('connected', 'Connected — waiting for a game');
        lastSaved.classList.add('hidden');
      }, 4000);
      break;

    case 'error':
      setStatus('error', `Error: ${payload.error || 'Unknown error'}`);
      break;
  }
});

// ─── Login ────────────────────────────────────────────────────────
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const result = await sendMessage('SIGN_IN', { email, password });

  loginBtn.disabled = false;
  loginBtn.textContent = 'Sign In';

  if (result.success) {
    showMain(result.profile);
    loadCurrentStatus();
  } else {
    loginError.textContent = result.error || 'Login failed. Check your credentials.';
  }
});

// ─── Logout ───────────────────────────────────────────────────────
logoutBtn.addEventListener('click', async () => {
  await sendMessage('SIGN_OUT', {});
  showLogin();
});

// ─── Helpers ─────────────────────────────────────────────────────
function sendMessage(type, payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      resolve(response || {});
    });
  });
}

// ─── Start ───────────────────────────────────────────────────────
init();

// Poll action count while recording
setInterval(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url?.includes('karabast')) return;
    chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, (resp) => {
      if (resp?.isRecording) {
        actionCount.textContent = resp.actionCount || 0;
      }
    });
  });
}, 2000);

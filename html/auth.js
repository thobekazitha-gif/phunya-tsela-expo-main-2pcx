/**
 * auth.js — Phunya Tsela v2.1
 * Uses NO array .find() or .filter() — plain for-loops only.
 */

(function (global) {
  'use strict';

  var USERS_KEY   = 'pt_users';
  var SESSION_KEY = 'pt_session';
  var APS_KEY     = 'pt_aps_';
  var PSYCH_KEY   = 'pt_psych_';
  var HISTORY_KEY = 'pt_history_';

  /* ── Storage helpers ─────────────────────────────────────────── */

  function getUsers() {
    var raw, parsed;
    try { raw = localStorage.getItem(USERS_KEY); } catch (e) { return []; }
    if (!raw) return [];
    try { parsed = JSON.parse(raw); } catch (e) {
      try { localStorage.removeItem(USERS_KEY); } catch (e2) {}
      return [];
    }
    if (Object.prototype.toString.call(parsed) !== '[object Array]') {
      try { localStorage.removeItem(USERS_KEY); } catch (e2) {}
      return [];
    }
    return parsed;
  }

  function saveUsers(users) {
    if (Object.prototype.toString.call(users) !== '[object Array]') users = [];
    try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (e) {}
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function hashPassword(pw) {
    var h = 0, i, ch;
    for (i = 0; i < pw.length; i++) {
      ch = pw.charCodeAt(i);
      h  = (((h << 5) - h) + ch) | 0;
    }
    return (h >>> 0).toString(16);
  }

  /* ── Public: register ────────────────────────────────────────── */

  function register(opts) {
    var users, emailLower, i, user;
    if (!opts || !opts.email || !opts.password || !opts.firstName || !opts.lastName) {
      return { ok: false, error: 'All required fields must be filled in.' };
    }
    users      = getUsers();
    emailLower = String(opts.email).toLowerCase().trim();
    for (i = 0; i < users.length; i++) {
      if (users[i] && String(users[i].email).toLowerCase() === emailLower) {
        return { ok: false, error: 'An account with this email already exists.' };
      }
    }
    user = {
      id:        generateId(),
      firstName: String(opts.firstName).trim(),
      lastName:  String(opts.lastName).trim(),
      email:     emailLower,
      password:  hashPassword(String(opts.password)),
      grade:     opts.grade  ? String(opts.grade)  : '',
      school:    opts.school ? String(opts.school) : '',
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    saveUsers(users);
    createSession(user);
    return { ok: true, user: pub(user) };
  }

  /* ── Public: login ───────────────────────────────────────────── */

  function login(opts) {
    var users, emailLower, i, user;
    if (!opts || !opts.email || !opts.password) {
      return { ok: false, error: 'Email and password are required.' };
    }
    users      = getUsers();
    emailLower = String(opts.email).toLowerCase().trim();
    user       = null;
    for (i = 0; i < users.length; i++) {
      if (users[i] && String(users[i].email).toLowerCase() === emailLower) {
        user = users[i]; break;
      }
    }
    if (!user) return { ok: false, error: 'No account found with that email.' };
    if (user.password !== hashPassword(String(opts.password))) {
      return { ok: false, error: 'Incorrect password.' };
    }
    createSession(user);
    return { ok: true, user: pub(user) };
  }

  /* ── Public: logout / getSession / requireAuth ───────────────── */

  function logout() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function getSession() {
    var raw, s, users, i;
    try { raw = localStorage.getItem(SESSION_KEY); } catch (e) { return null; }
    if (!raw) return null;
    try { s = JSON.parse(raw); } catch (e) { return null; }
    if (!s || !s.userId) return null;
    users = getUsers();
    for (i = 0; i < users.length; i++) {
      if (users[i] && users[i].id === s.userId) return pub(users[i]);
    }
    logout();
    return null;
  }

  function requireAuth() {
    var user = getSession();
    if (!user) {
      var page = (window.location.pathname.split('/').pop()) || 'index.html';
      window.location.href = 'login.html?redirect=' + encodeURIComponent(page);
      return null;
    }
    return user;
  }

  /* ── Internal helpers ────────────────────────────────────────── */

  function createSession(user) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, at: Date.now() })); } catch (e) {}
  }

  function pub(u) {
    return { id: u.id, firstName: u.firstName, lastName: u.lastName,
             email: u.email, grade: u.grade || '', school: u.school || '' };
  }

  function shallowCopy(obj) {
    var out = {}, k;
    for (k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k]; }
    return out;
  }

  /* ── Per-user data ───────────────────────────────────────────── */

  function saveAPSResult(userId, data) {
    var entry;
    try {
      entry = shallowCopy(data);
      entry.savedAt = new Date().toISOString();
      localStorage.setItem(APS_KEY + userId, JSON.stringify(entry));
      pushHistory(userId, { type:'aps', label:'APS Calculator',
        summary: data.summary || ('APS Score: ' + (data.apsScore || '')),
        savedAt: entry.savedAt, data: entry });
    } catch (e) { console.warn('saveAPSResult:', e); }
  }

  function loadAPSResult(userId) {
    try { return JSON.parse(localStorage.getItem(APS_KEY + userId)); } catch (e) { return null; }
  }

  function savePsychResult(userId, data) {
    var entry;
    try {
      entry = shallowCopy(data);
      entry.savedAt = new Date().toISOString();
      localStorage.setItem(PSYCH_KEY + userId, JSON.stringify(entry));
      pushHistory(userId, { type:'psych', label:'Career Psychometric Test',
        summary: data.summary || ('Primary type: ' + (data.primaryType || '')),
        savedAt: entry.savedAt, data: entry });
    } catch (e) { console.warn('savePsychResult:', e); }
  }

  function loadPsychResult(userId) {
    try { return JSON.parse(localStorage.getItem(PSYCH_KEY + userId)); } catch (e) { return null; }
  }

  function pushHistory(userId, entry) {
    var history;
    entry.id = generateId();
    history  = loadHistory(userId);
    history.unshift(entry);
    try { localStorage.setItem(HISTORY_KEY + userId, JSON.stringify(history.slice(0, 50))); } catch (e) {}
  }

  function loadHistory(userId) {
    var raw, parsed;
    try { raw = localStorage.getItem(HISTORY_KEY + userId); } catch (e) { return []; }
    if (!raw) return [];
    try { parsed = JSON.parse(raw); } catch (e) { return []; }
    return (Object.prototype.toString.call(parsed) === '[object Array]') ? parsed : [];
  }

  function clearHistory(userId) {
    try { localStorage.removeItem(HISTORY_KEY + userId); } catch (e) {}
  }

  /* ── Attach to window ────────────────────────────────────────── */

  global.Auth = {
    register:        register,
    login:           login,
    logout:          logout,
    getSession:      getSession,
    requireAuth:     requireAuth,
    saveAPSResult:   saveAPSResult,
    loadAPSResult:   loadAPSResult,
    savePsychResult: savePsychResult,
    loadPsychResult: loadPsychResult,
    loadHistory:     loadHistory,
    clearHistory:    clearHistory,
  };

}(window));
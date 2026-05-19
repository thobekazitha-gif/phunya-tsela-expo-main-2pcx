/**
 * auth.js — Phunya Tsela v3.1
 * Supabase Authentication + Local Storage User Data
 * Fixed: requireAuth is now fully async, user metadata correctly extracted
 */

(function (global) {
  'use strict';

  /* ── SUPABASE CONFIG ───────────────────────────────── */

  var SUPABASE_URL = 'https://lfnnglzjqszdjomjmpkw.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_zfTqPTfONlZ04Of9ERrKww_2ICi7FCU';
  var supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  /* ── LOCAL STORAGE KEYS ───────────────────────────── */

  var APS_KEY     = 'pt_aps_';
  var PSYCH_KEY   = 'pt_psych_';
  var HISTORY_KEY = 'pt_history_';

  /* ── HELPERS ──────────────────────────────────────── */

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function shallowCopy(obj) {
    var out = {}, k;
    for (k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
    }
    return out;
  }

  /**
   * Normalise a raw Supabase user object into a friendly shape.
   * Supabase stores custom fields inside user.user_metadata.
   */
  function normaliseUser(rawUser) {
    if (!rawUser) return null;
    var meta = rawUser.user_metadata || {};
    return {
      id:        rawUser.id,
      email:     rawUser.email || '',
      firstName: meta.firstName || meta.first_name || '',
      lastName:  meta.lastName  || meta.last_name  || '',
      grade:     meta.grade     || '',
      school:    meta.school    || '',
    };
  }

  /* ── AUTH: REGISTER ───────────────────────────────── */

  async function register(opts) {
    if (!opts || !opts.email || !opts.password || !opts.firstName || !opts.lastName) {
      return { ok: false, error: 'All required fields must be filled in.' };
    }

    var result = await supabaseClient.auth.signUp({
      email:    String(opts.email).toLowerCase().trim(),
      password: String(opts.password),
      options: {
        data: {
          firstName: String(opts.firstName).trim(),
          lastName:  String(opts.lastName).trim(),
          grade:     opts.grade  ? String(opts.grade)  : '',
          school:    opts.school ? String(opts.school) : '',
        }
      }
    });

    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, user: normaliseUser(result.data.user) };
  }

  /* ── AUTH: LOGIN ──────────────────────────────────── */

  async function login(opts) {
    if (!opts || !opts.email || !opts.password) {
      return { ok: false, error: 'Email and password are required.' };
    }

    var result = await supabaseClient.auth.signInWithPassword({
      email:    String(opts.email).toLowerCase().trim(),
      password: String(opts.password),
    });

    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, user: normaliseUser(result.data.user) };
  }

  /* ── AUTH: LOGOUT ─────────────────────────────────── */

  async function logout() {
    await supabaseClient.auth.signOut();
  }

  /* ── AUTH: GET SESSION ────────────────────────────── */

  /**
   * Returns a normalised user object if a session exists, otherwise null.
   */
  async function getSession() {
    var result = await supabaseClient.auth.getSession();
    if (result && result.data && result.data.session) {
      return normaliseUser(result.data.session.user);
    }
    return null;
  }

  /* ── AUTH: REQUIRE LOGIN ──────────────────────────── */

  /**
   * ASYNC — must be awaited.
   * Redirects to login if no session, otherwise returns normalised user.
   *
   * Usage in every protected page:
   *   document.addEventListener('DOMContentLoaded', async function() {
   *     var user = await Auth.requireAuth();
   *     if (!user) return; // redirect already fired
   *     // ... use user.firstName etc.
   *   });
   */
  async function requireAuth() {
    var user = await getSession();
    if (!user) {
      var page = (window.location.pathname.split('/').pop()) || 'index.html';
      window.location.href = 'login.html?redirect=' + encodeURIComponent(page);
      return null;
    }
    return user;
  }

  /* ── AUTH: FORGOT PASSWORD ────────────────────────── */

  async function forgotPassword(email) {
    var result = await supabaseClient.auth.resetPasswordForEmail(
      String(email).toLowerCase().trim(),
      { redirectTo: window.location.origin + '/reset-password.html' }
    );
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true };
  }

  /* ── AUTH: UPDATE PASSWORD ────────────────────────── */

  async function updatePassword(password) {
    var result = await supabaseClient.auth.updateUser({ password: String(password) });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true };
  }

  /* ── APS STORAGE ──────────────────────────────────── */

  function saveAPSResult(userId, data) {
    try {
      var entry = shallowCopy(data);
      entry.savedAt = new Date().toISOString();
      localStorage.setItem(APS_KEY + userId, JSON.stringify(entry));
      pushHistory(userId, {
        type: 'aps',
        label: 'APS Calculator',
        summary: data.summary || ('APS Score: ' + (data.apsScore || '')),
        savedAt: entry.savedAt,
        data: entry,
      });
    } catch (e) {
      console.warn('saveAPSResult:', e);
    }
  }

  function loadAPSResult(userId) {
    try { return JSON.parse(localStorage.getItem(APS_KEY + userId)); }
    catch (e) { return null; }
  }

  /* ── PSYCH STORAGE ────────────────────────────────── */

  function savePsychResult(userId, data) {
    try {
      var entry = shallowCopy(data);
      entry.savedAt = new Date().toISOString();
      localStorage.setItem(PSYCH_KEY + userId, JSON.stringify(entry));
      pushHistory(userId, {
        type: 'psych',
        label: 'Career Psychometric Test',
        summary: data.summary || ('Primary type: ' + (data.primaryType || '')),
        savedAt: entry.savedAt,
        data: entry,
      });
    } catch (e) {
      console.warn('savePsychResult:', e);
    }
  }

  function loadPsychResult(userId) {
    try { return JSON.parse(localStorage.getItem(PSYCH_KEY + userId)); }
    catch (e) { return null; }
  }

  /* ── HISTORY ──────────────────────────────────────── */

  function pushHistory(userId, entry) {
    entry.id = generateId();
    var history = loadHistory(userId);
    history.unshift(entry);
    try {
      localStorage.setItem(HISTORY_KEY + userId, JSON.stringify(history.slice(0, 50)));
    } catch (e) {}
  }

  function loadHistory(userId) {
    var raw, parsed;
    try { raw = localStorage.getItem(HISTORY_KEY + userId); }
    catch (e) { return []; }
    if (!raw) return [];
    try { parsed = JSON.parse(raw); }
    catch (e) { return []; }
    return (Object.prototype.toString.call(parsed) === '[object Array]') ? parsed : [];
  }

  function clearHistory(userId) {
    try { localStorage.removeItem(HISTORY_KEY + userId); } catch (e) {}
  }

  /* ── PUBLIC API ───────────────────────────────────── */

  global.Auth = {
    register,
    login,
    logout,
    getSession,
    requireAuth,
    forgotPassword,
    updatePassword,
    saveAPSResult,
    loadAPSResult,
    savePsychResult,
    loadPsychResult,
    loadHistory,
    clearHistory,
  };

}(window));
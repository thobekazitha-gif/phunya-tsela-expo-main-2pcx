/**
 * auth.js — Phunya Tsela v4.1
 * Supabase Authentication + Local Storage User Data
 * Supports: email+password OR phone+password
 *
 * FIX (v4.1): Phone logins now work by converting the phone number to a
 * synthetic email address (e.g. +27821234567@phunya-tsela.app) so that
 * Supabase's always-available email+password flow is used instead of the
 * phone/OTP flow (which requires Twilio and is disabled by default).
 */

(function (global) {
  'use strict';

  /* ── SUPABASE CONFIG ───────────────────────────────── */

  var SUPABASE_URL = 'https://lfnnglzjqszdjomjmpkw.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_zfTqPTfONlZ04Of9ERrKww_2ICi7FCU';
  var supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  /* ── PHONE-AS-EMAIL DOMAIN ─────────────────────────── */
  // We store phone users as <e164>@phunya-tsela.app so Supabase always uses
  // the email+password provider (no Twilio / phone OTP needed).
  var PHONE_EMAIL_DOMAIN = 'phunya-tsela.app';

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
   */
  function normaliseUser(rawUser) {
    if (!rawUser) return null;
    var meta = rawUser.user_metadata || {};
    return {
      id:        rawUser.id,
      email:     rawUser.email || '',
      phone:     rawUser.phone || meta.phone || meta.rawPhone || '',
      firstName: meta.firstName || meta.first_name || '',
      lastName:  meta.lastName  || meta.last_name  || '',
      grade:     meta.grade     || '',
      school:    meta.school    || '',
    };
  }

  /**
   * Normalise a SA phone number to E.164 format (+27...).
   * Accepts: 0821234567, 082 123 4567, +27821234567, 27821234567
   */
  function normalisePhone(raw) {
    var digits = String(raw).replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('27')) return '+' + digits;
    if (digits.length === 10 && digits.startsWith('0'))  return '+27' + digits.slice(1);
    return null; // invalid
  }

  /**
   * Convert an E.164 phone to a synthetic email address.
   * e.g. "+27821234567" → "ph_27821234567@phunya-tsela.app"
   * The "ph_" prefix avoids any domain issues with leading "+".
   */
  function phoneToEmail(e164) {
    return 'ph_' + e164.replace('+', '') + '@' + PHONE_EMAIL_DOMAIN;
  }

  function isEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }

  function isPhone(val) {
    return /^[0-9\s\+\-()]+$/.test(val) && val.replace(/\D/g,'').length >= 9;
  }

  /* ── AUTH: REGISTER ───────────────────────────────── */

  async function register(opts) {
    if (!opts || !opts.identifier || !opts.password || !opts.firstName || !opts.lastName) {
      return { ok: false, error: 'All required fields must be filled in.' };
    }

    var identifier = String(opts.identifier).trim();
    var emailToUse, rawPhone = '';

    if (isEmail(identifier)) {
      emailToUse = identifier.toLowerCase();
    } else if (isPhone(identifier)) {
      var e164 = normalisePhone(identifier);
      if (!e164) return { ok: false, error: 'Invalid phone number. Use format: 0821234567.' };
      emailToUse = phoneToEmail(e164);
      rawPhone   = e164;
    } else {
      return { ok: false, error: 'Enter a valid email address or SA cell number.' };
    }

    var result = await supabaseClient.auth.signUp({
      email:    emailToUse,
      password: String(opts.password),
      options: {
        data: {
          firstName: String(opts.firstName).trim(),
          lastName:  String(opts.lastName).trim(),
          grade:     opts.grade  ? String(opts.grade)  : '',
          school:    opts.school ? String(opts.school) : '',
          rawPhone:  rawPhone,   // store original phone for display
        },
        emailRedirectTo: null,
      }
    });

    if (result.error) return { ok: false, error: result.error.message };

    // If Supabase returns a session immediately (email confirm disabled), great
    if (result.data && result.data.session) {
      return { ok: true, user: normaliseUser(result.data.user) };
    }

    // Auto-login after sign-up
    return await login({ identifier: identifier, password: opts.password });
  }

  /* ── AUTH: LOGIN ──────────────────────────────────── */

  async function login(opts) {
    if (!opts || !opts.identifier || !opts.password) {
      return { ok: false, error: 'Please enter your email/phone and password.' };
    }

    var identifier = String(opts.identifier).trim();
    var emailToUse;

    if (isEmail(identifier)) {
      emailToUse = identifier.toLowerCase();
    } else if (isPhone(identifier)) {
      var e164 = normalisePhone(identifier);
      if (!e164) return { ok: false, error: 'Invalid phone number. Use format: 0821234567.' };
      emailToUse = phoneToEmail(e164);
    } else {
      return { ok: false, error: 'Enter a valid email address or SA cell number.' };
    }

    var result = await supabaseClient.auth.signInWithPassword({
      email:    emailToUse,
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

  async function getSession() {
    var result = await supabaseClient.auth.getSession();
    if (result && result.data && result.data.session) {
      return normaliseUser(result.data.session.user);
    }
    return null;
  }

  /* ── AUTH: REQUIRE LOGIN ──────────────────────────── */

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

  async function forgotPassword(identifier) {
    var emailToUse;
    identifier = String(identifier).trim();

    if (isEmail(identifier)) {
      emailToUse = identifier.toLowerCase();
    } else if (isPhone(identifier)) {
      var e164 = normalisePhone(identifier);
      if (!e164) return { ok: false, error: 'Invalid phone number.' };
      emailToUse = phoneToEmail(e164);
    } else {
      return { ok: false, error: 'Enter a valid email address or SA cell number.' };
    }

    var result = await supabaseClient.auth.resetPasswordForEmail(
      emailToUse,
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
        type:    'aps',
        label:   'APS Calculator',
        summary: data.summary || ('APS Score: ' + (data.apsScore || '')),
        savedAt: entry.savedAt,
        data:    entry,
      });
    } catch (e) { console.warn('saveAPSResult:', e); }
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
        type:    'psych',
        label:   'Career Psychometric Test',
        summary: data.summary || ('Primary type: ' + (data.primaryType || '')),
        savedAt: entry.savedAt,
        data:    entry,
      });
    } catch (e) { console.warn('savePsychResult:', e); }
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
    try { localStorage.setItem(HISTORY_KEY + userId, JSON.stringify(history.slice(0, 50))); }
    catch (e) {}
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
    // Utilities exposed for pages that need them
    normalisePhone,
    phoneToEmail,
    isEmail,
    isPhone,
  };

}(window));
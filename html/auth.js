/**
 * auth.js — Phunya Tsela v5.0
 *
 * HOW PHONE AUTH WORKS (no OTP, no verification, no custom table needed):
 * ─────────────────────────────────────────────────────────────────────────
 * Supabase Auth requires an email OR phone for every account.
 * Their phone provider needs Twilio (disabled on free plans).
 * Their email provider works fine but sends confirmation emails.
 *
 * SOLUTION:
 *   1. In Supabase Dashboard → Authentication → Settings:
 *        ✅ Disable "Enable email confirmations"  ← REQUIRED
 *        (Users sign up instantly with no email sent)
 *
 *   2. We convert a phone number into a private internal email that
 *      Supabase uses only as a unique key — it is NEVER shown to
 *      students, never emailed, never validated externally.
 *      Format: pt{digits}@pt.local
 *      e.g.  0821234567  →  pt27821234567@pt.local
 *
 *   3. The student's real phone number is saved in user_metadata.phone
 *      so you can display it on the dashboard.
 *
 *   4. Login with phone works by re-deriving the same internal email.
 *
 * Net result: students sign up / sign in with just their phone number
 * and password. No OTP. No email. No verification. Instant access.
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

  function normaliseUser(rawUser) {
    if (!rawUser) return null;
    var meta = rawUser.user_metadata || {};
    return {
      id:        rawUser.id,
      phone:     meta.phone     || '',
      email:     meta.realEmail || '',          // only set for email sign-ups
      firstName: meta.firstName || meta.first_name || '',
      lastName:  meta.lastName  || meta.last_name  || '',
      grade:     meta.grade     || '',
      school:    meta.school    || '',
    };
  }

  /**
   * Normalise SA phone → E.164 digits (no +).
   * Accepts: 0821234567 / 082 123 4567 / +27821234567 / 27821234567
   */
  function normalisePhone(raw) {
    var digits = String(raw).replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('27')) return digits;        // 27821234567
    if (digits.length === 10 && digits.startsWith('0'))  return '27' + digits.slice(1); // 0821234567
    return null; // invalid
  }

  /**
   * Build a deterministic internal email from a phone number.
   * Supabase uses this only as a unique key — it is never shown or emailed.
   */
  function phoneToInternalEmail(digits) {
    return 'pt' + digits + '@pt.local';
  }

  function isEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }

  function isPhone(val) {
    return /^[0-9\s\+\-()]+$/.test(val) && val.replace(/\D/g, '').length >= 9;
  }

  /* ── REGISTER ─────────────────────────────────────── */

  async function register(opts) {
    if (!opts || !opts.identifier || !opts.password || !opts.firstName || !opts.lastName) {
      return { ok: false, error: 'All required fields must be filled in.' };
    }

    var identifier = String(opts.identifier).trim();
    var emailToUse, metaPhone = '', metaRealEmail = '';

    if (isEmail(identifier)) {
      emailToUse    = identifier.toLowerCase();
      metaRealEmail = emailToUse;
    } else if (isPhone(identifier)) {
      var digits = normalisePhone(identifier);
      if (!digits) return { ok: false, error: 'Invalid phone number. Try: 0821234567' };
      emailToUse = phoneToInternalEmail(digits);
      metaPhone  = '+' + digits;
    } else {
      return { ok: false, error: 'Enter a valid email address or SA cell number.' };
    }

    var result = await supabaseClient.auth.signUp({
      email:    emailToUse,
      password: String(opts.password),
      options: {
        emailRedirectTo: null,
        data: {
          firstName: String(opts.firstName).trim(),
          lastName:  String(opts.lastName).trim(),
          grade:     opts.grade  ? String(opts.grade)  : '',
          school:    opts.school ? String(opts.school) : '',
          phone:     metaPhone,
          realEmail: metaRealEmail,
        },
      },
    });

    if (result.error) {
      // Friendly message for duplicate accounts
      if (result.error.message.toLowerCase().includes('already registered')) {
        return { ok: false, error: 'An account with this ' + (metaPhone ? 'number' : 'email') + ' already exists. Please sign in.' };
      }
      return { ok: false, error: result.error.message };
    }

    if (result.data && result.data.session) {
      return { ok: true, user: normaliseUser(result.data.user) };
    }

    // Email confirmations disabled → auto-login
    return await login({ identifier: identifier, password: opts.password });
  }

  /* ── LOGIN ────────────────────────────────────────── */

  async function login(opts) {
    if (!opts || !opts.identifier || !opts.password) {
      return { ok: false, error: 'Please enter your cell number / email and password.' };
    }

    var identifier = String(opts.identifier).trim();
    var emailToUse;

    if (isEmail(identifier)) {
      emailToUse = identifier.toLowerCase();
    } else if (isPhone(identifier)) {
      var digits = normalisePhone(identifier);
      if (!digits) return { ok: false, error: 'Invalid phone number. Try: 0821234567' };
      emailToUse = phoneToInternalEmail(digits);
    } else {
      return { ok: false, error: 'Enter a valid email address or SA cell number.' };
    }

    var result = await supabaseClient.auth.signInWithPassword({
      email:    emailToUse,
      password: String(opts.password),
    });

    if (result.error) {
      var msg = result.error.message;
      // Friendlier errors
      if (msg.toLowerCase().includes('invalid login')) {
        return { ok: false, error: 'Incorrect number/email or password. Please try again.' };
      }
      return { ok: false, error: msg };
    }

    return { ok: true, user: normaliseUser(result.data.user) };
  }

  /* ── LOGOUT ───────────────────────────────────────── */

  async function logout() {
    await supabaseClient.auth.signOut();
  }

  /* ── GET SESSION ──────────────────────────────────── */

  async function getSession() {
    var result = await supabaseClient.auth.getSession();
    if (result && result.data && result.data.session) {
      return normaliseUser(result.data.session.user);
    }
    return null;
  }

  /* ── REQUIRE AUTH ─────────────────────────────────── */

  async function requireAuth() {
    var user = await getSession();
    if (!user) {
      var page = (window.location.pathname.split('/').pop()) || 'index.html';
      window.location.href = 'login.html?redirect=' + encodeURIComponent(page);
      return null;
    }
    return user;
  }

  /* ── FORGOT PASSWORD ──────────────────────────────── */

  async function forgotPassword(identifier) {
    identifier = String(identifier).trim();
    var emailToUse;

    if (isEmail(identifier)) {
      emailToUse = identifier.toLowerCase();
    } else if (isPhone(identifier)) {
      var digits = normalisePhone(identifier);
      if (!digits) return { ok: false, error: 'Invalid phone number.' };
      emailToUse = phoneToInternalEmail(digits);
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

  /* ── UPDATE PASSWORD ──────────────────────────────── */

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
    var raw;
    try { raw = localStorage.getItem(HISTORY_KEY + userId); } catch (e) { return []; }
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
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
    normalisePhone,
    isEmail,
    isPhone,
  };

}(window));
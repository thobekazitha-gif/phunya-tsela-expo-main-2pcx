/**
 * auth.js — Phunya Tsela  (v8 — Supabase load-safe)
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles auth, profile, history (localStorage), and result syncing to Supabase.
 * IMPORTANT: This file must be loaded AFTER the Supabase CDN script tag.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── CONFIG ────────────────────────────────────────────────────────────────────
var SUPABASE_URL = 'https://lfnnglzjqszdjomjmpkw.supabase.co';


var SUPABASE_KEY = 'sb_publishable_zfTqPTfONlZ04Of9ERrKww_2ICi7FCU';
// ─────────────────────────────────────────────────────────────────────────────

var _sbClient = null;

/**
 * Returns the Supabase client, throwing a clear error if the CDN
 * hasn't loaded yet (so the developer knows exactly what's wrong).
 */
function _sb() {
  if (_sbClient) return _sbClient;

  // Check every possible way the Supabase CDN exposes itself
  var sbLib = (typeof supabase !== 'undefined' && supabase)
           || (typeof window !== 'undefined' && window.supabase)
           || (typeof globalThis !== 'undefined' && globalThis.supabase);

  if (!sbLib || typeof sbLib.createClient !== 'function') {
    throw new Error(
      'Supabase CDN not loaded. Add this BEFORE auth.js on every page:\n' +
      '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"><\/script>'
    );
  }

  _sbClient = sbLib.createClient(SUPABASE_URL, SUPABASE_KEY);
  return _sbClient;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phone → email helper
// ─────────────────────────────────────────────────────────────────────────────
function _phoneToEmail(raw) {
  var digits = raw.replace(/[\s\-()]/g, '');
  if (digits.startsWith('+27')) {
    digits = '0' + digits.slice(3);
  }
  return digits + '@phunya.local';
}

function _isPhone(identifier) {
  return /^(\+27|0)\d[\d\s\-]{6,}$/.test(identifier.trim());
}

function _buildEmail(identifier) {
  var clean = identifier.trim();
  return _isPhone(clean) ? _phoneToEmail(clean) : clean;
}

// ─────────────────────────────────────────────────────────────────────────────
// localStorage history helpers
// ─────────────────────────────────────────────────────────────────────────────
var HISTORY_PREFIX = 'phunya_history_';
function _historyKey(uid) { return HISTORY_PREFIX + uid; }

// ─────────────────────────────────────────────────────────────────────────────
// Auth object
// ─────────────────────────────────────────────────────────────────────────────
var Auth = {

  // ── Auth ──────────────────────────────────────────────────────────────────

  async register({ identifier, firstName, lastName, password, grade, school }) {
    try {
      var email = _buildEmail(identifier);
      var phone = _isPhone(identifier.trim()) ? identifier.trim() : null;

      var { data, error } = await _sb().auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name:  lastName,
            grade:      grade  || '',
            school:     school || '',
            phone:      phone  || '',
          }
        }
      });

      if (error) return { ok: false, error: error.message };
      if (!data.user) return { ok: false, error: 'Registration failed. Please try again.' };

      var { error: profileError } = await _sb().from('profiles').upsert({
        id:         data.user.id,
        email:      email,
        first_name: firstName,
        last_name:  lastName,
        grade:      grade  || '',
        school:     school || '',
        phone:      phone  || '',
        role:       'learner',
      }, { onConflict: 'id' });

      if (profileError) {
        console.warn('Profile save error:', profileError.message);
      }

      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async login({ identifier, password }) {
    try {
      var email = _buildEmail(identifier);
      var { data, error } = await _sb().auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: 'Incorrect details. Please check and try again.' };
      if (!data.user) return { ok: false, error: 'Login failed.' };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async getSession() {
    try {
      var { data } = await _sb().auth.getSession();
      return data.session || null;
    } catch (e) {
      console.error('getSession error:', e.message);
      return null;
    }
  },

  async requireAuth() {
    try {
      var session = await this.getSession();
      if (!session || !session.user) {
        window.location.href = 'login.html';
        return null;
      }

      var uid  = session.user.id;
      var meta = session.user.user_metadata || {};

      var profile = null;
      try {
        var { data } = await _sb().from('profiles').select('*').eq('id', uid).single();
        profile = data;
      } catch (e) { /* fallback to meta */ }

      return {
        id:        uid,
        email:     session.user.email,
        firstName: (profile && profile.first_name) || meta.first_name || '',
        lastName:  (profile && profile.last_name)  || meta.last_name  || '',
        grade:     (profile && profile.grade)       || meta.grade      || '',
        school:    (profile && profile.school)      || meta.school     || '',
        phone:     (profile && profile.phone)       || meta.phone      || '',
        role:      (profile && profile.role)        || 'learner',
      };
    } catch (e) {
      console.error('requireAuth error:', e.message);
      window.location.href = 'login.html';
      return null;
    }
  },

  async logout() {
    try { await _sb().auth.signOut(); } catch (e) { /* ignore */ }
  },

  // ── History (localStorage) ────────────────────────────────────────────────

  loadHistory(uid) {
    try {
      var raw = localStorage.getItem(_historyKey(uid));
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  },

  _saveHistory(uid, history) {
    try {
      localStorage.setItem(_historyKey(uid), JSON.stringify(history));
    } catch (e) { /* storage full */ }
  },

  clearHistory(uid) {
    localStorage.removeItem(_historyKey(uid));
  },

  // ── Save APS Result ───────────────────────────────────────────────────────

  async saveAPSResult(uid, { apsScore, subjects, mathType, summary }) {
    var history = this.loadHistory(uid);
    history.unshift({
      type:    'aps',
      savedAt: new Date().toISOString(),
      summary: summary || ('APS Score: ' + apsScore),
      data: {
        apsScore,
        total:    apsScore,
        subjects: subjects || [],
        mathType: mathType || 'mathematics',
      },
    });
    this._saveHistory(uid, history);

    try {
      var sb = _sb();
      var { data: sessionData } = await sb.auth.getSession();
      if (!sessionData || !sessionData.session) {
        console.warn('No active Supabase session — APS result saved to localStorage only');
        return;
      }

      var { error: delError } = await sb.from('aps_results').delete().eq('user_id', uid);
      if (delError) console.warn('APS delete before insert failed:', delError.message);

      var { error: insError } = await sb.from('aps_results').insert({
        user_id:   uid,
        aps_score: apsScore,
        subjects:  subjects || [],
        math_type: mathType || 'mathematics',
      });

      if (insError) {
        console.error('Supabase APS save error:', insError.message);
      } else {
        console.log('APS result saved to Supabase — score:', apsScore);
      }
    } catch (e) {
      console.error('Supabase APS save exception:', e.message);
    }
  },

  // ── Save Psychometric Result ──────────────────────────────────────────────

  async savePsychResult(uid, { scores, topTypes, primaryType, summary }) {
    var history = this.loadHistory(uid);
    history.unshift({
      type:    'psych',
      savedAt: new Date().toISOString(),
      summary: summary || ('Primary type: ' + (topTypes && topTypes[0])),
      data: {
        scores:      scores   || {},
        topTypes:    topTypes || [],
        primaryType: primaryType || (topTypes && topTypes[0]) || '',
      },
    });
    this._saveHistory(uid, history);

    try {
      var sb = _sb();
      var { data: sessionData } = await sb.auth.getSession();
      if (!sessionData || !sessionData.session) {
        console.warn('No active Supabase session — psych result saved to localStorage only');
        return;
      }

      var { error: delError } = await sb.from('psych_results').delete().eq('user_id', uid);
      if (delError) console.warn('Psych delete before insert failed:', delError.message);

      var topTypesArray = Array.isArray(topTypes) ? topTypes : [];

      var { error: insError } = await sb.from('psych_results').insert({
        user_id:      uid,
        primary_type: primaryType || (topTypesArray[0]) || '',
        top_types:    topTypesArray,
        scores:       scores || {},
      });

      if (insError) {
        console.error('Supabase psych save error:', insError.message);
      } else {
        console.log('Psych result saved to Supabase — type:', primaryType || topTypesArray[0]);
      }
    } catch (e) {
      console.error('Supabase psych save exception:', e.message);
    }
  },
};
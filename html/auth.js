/**
 * auth.js — Phunya Tsela shared authentication & local storage module
 * Uses localStorage to persist users, sessions, and per-user app data.
 */

const Auth = (() => {
  const USERS_KEY   = 'pt_users';
  const SESSION_KEY = 'pt_session';
  const APS_KEY     = 'pt_aps_';    // + userId
  const PSYCH_KEY   = 'pt_psych_';  // + userId

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch { return []; }
  }
  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  function hashPassword(pw) {
    // Simple deterministic obfuscation — NOT cryptographic, fine for local demo
    let h = 0;
    for (let i = 0; i < pw.length; i++) { h = (Math.imul(31, h) + pw.charCodeAt(i)) | 0; }
    return h.toString(16);
  }

  // ── Auth API ──────────────────────────────────────────────────────────────
  function register({ firstName, lastName, email, password, grade, school }) {
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { ok: false, error: 'An account with this email already exists.' };
    }
    const user = {
      id:        generateId(),
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      email:     email.toLowerCase().trim(),
      password:  hashPassword(password),
      grade:     grade || '',
      school:    school || '',
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    saveUsers(users);
    _createSession(user);
    return { ok: true, user: _publicUser(user) };
  }

  function login({ email, password }) {
    const users = getUsers();
    const user  = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!user) return { ok: false, error: 'No account found with that email.' };
    if (user.password !== hashPassword(password)) return { ok: false, error: 'Incorrect password.' };
    _createSession(user);
    return { ok: true, user: _publicUser(user) };
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getSession() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (!s) return null;
      const users = getUsers();
      const user  = users.find(u => u.id === s.userId);
      if (!user) { logout(); return null; }
      return _publicUser(user);
    } catch { return null; }
  }

  /**
   * Call at the top of any protected page.
   * If not logged in, redirects to login.html with ?redirect=<currentPage>
   * Returns the user object if logged in, otherwise null (and redirects).
   */
  function requireAuth() {
    const user = getSession();
    if (!user) {
      const current = window.location.pathname.split('/').pop() || 'index.html';
      window.location.href = 'login.html?redirect=' + encodeURIComponent(current);
      return null;
    }
    return user;
  }

  function _createSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, at: Date.now() }));
  }
  function _publicUser(u) {
    return { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, grade: u.grade, school: u.school };
  }

  // ── Per-user data storage ─────────────────────────────────────────────────
  function saveAPSResult(userId, data) {
    localStorage.setItem(APS_KEY + userId, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
  }
  function loadAPSResult(userId) {
    try { return JSON.parse(localStorage.getItem(APS_KEY + userId)); } catch { return null; }
  }
  function savePsychResult(userId, data) {
    localStorage.setItem(PSYCH_KEY + userId, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
  }
  function loadPsychResult(userId) {
    try { return JSON.parse(localStorage.getItem(PSYCH_KEY + userId)); } catch { return null; }
  }

  return { register, login, logout, getSession, requireAuth, saveAPSResult, loadAPSResult, savePsychResult, loadPsychResult };
})();
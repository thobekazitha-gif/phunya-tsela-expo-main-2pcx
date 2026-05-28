/* ============================================================
   PHUNYA TSELA CAREER EXPO 2026 — script.js
   ============================================================ */

/* ── FAQ DATA ── */
const FAQS = [
  {
    q: "Who should sponsor vs. exhibit?",
    a: "Sponsors invest in headline visibility, branding integration, and strategic alignment with the event's mission — ideal for organisations wanting maximum exposure and community impact association. Exhibitors book a booth to engage directly with learners, educators, and community members. Both options offer powerful returns; it depends on whether you want broad brand awareness (sponsor) or hands-on engagement (exhibitor)."
  },
  {
    q: "What does a paying exhibitor receive?",
    a: "A standard 3m × 2m booth with fascia branding, pull-up banner space, a featured listing in the programme and online exhibitor directory, direct access to thousands of learners, and a post-event proof pack including photos, attendance data, and engagement summary."
  },
  {
    q: "How are stands allocated?",
    a: "Stands are allocated on a first-confirmed, first-placed basis. Once your booking is confirmed and payment received, we assign your position based on your package tier and sector to ensure a balanced, high-traffic layout. Headline partners receive priority placement."
  },
  {
    q: "What are the setup times and access arrangements?",
    a: "Setup day is typically the day before the event (exact dates communicated in your exhibitor pack). You'll have full access from 08:00–18:00 on setup day. On event day, exhibitor access opens at 06:30 for final preparations before doors open to learners at 08:30."
  },
  {
    q: "What are the branding rules?",
    a: "Headline partners (Platinum, Host, Strategic) receive integrated branding across all event collateral, signage, and digital platforms. Standard exhibitors receive booth fascia branding, pull-up banner space, and a featured listing. All branding must be professional and aligned with the event's youth-friendly, educational tone."
  },
  {
    q: "What is included in the proof pack?",
    a: "Every exhibitor and sponsor receives a post-event proof pack containing: professional photographs of your stand, event attendance statistics, media coverage summary, social media reach data, and a letter of participation. Sponsors receive an expanded impact report."
  },
  {
    q: "What are the payment terms?",
    a: "Full payment is required within 14 days of invoice to secure your booking. For sponsors, a 50% deposit secures your package with the balance due 30 days before the event. We issue tax invoices and can accommodate purchase order processes."
  },
  {
    q: "What is the cancellation policy?",
    a: "Cancellations made 60+ days before the event receive a full refund less a 10% admin fee. Cancellations 30–59 days out receive a 50% refund. Within 30 days, bookings are non-refundable but substitutions (different representative or organisation transfer) are permitted with written notice."
  },
  {
    q: "How is data handled (POPIA)?",
    a: "We collect only necessary contact and organisational information for booking and communication purposes. Learner data shared with exhibitors is limited to aggregate engagement stats. No personal learner data is shared without explicit consent. All data handling complies with South Africa's Protection of Personal Information Act (POPIA)."
  },
  {
    q: "Can organisations co-sponsor?",
    a: "Yes! We welcome co-sponsorship arrangements. Two or more organisations can share a sponsorship tier, splitting costs and benefits. Contact our team to discuss a tailored co-sponsorship package that works for all parties."
  },
  {
    q: "How does the Sports & FAME Hall work?",
    a: "The Sports & FAME (Film, Arts, Media, Entertainment & Sports) Hall is a dedicated space for creative and athletic career pathways. It features approximately 22 booths, live performance/demo areas, and career theatre sessions focused on non-traditional careers. It's ideal for sports federations, media houses, arts councils, and entertainment industry players."
  },
  {
    q: "How do school and learner registrations work?",
    a: "Schools register through the Kasi Career Expo platform. Each school submits a registration form with estimated learner numbers, transport arrangements, and educator details. Learners attend free of charge. Pre-registered schools receive structured visit schedules to ensure quality engagement time with exhibitors."
  },
];

/* ── ROUTE MAP ── */
const ROUTE_MAP = {
  '/bursary-portal':    'bursary-portal.html',
  '/psychometric-test': 'psychometric-test.html',
  '/aps-calculator':    'aps-calculator.html',
};

/* ── AUTH HELPERS ── */
function ptIsLoggedIn() {
  try {
    var session = JSON.parse(localStorage.getItem('pt_session'));
    if (!session || !session.userId) return false;
    var users = JSON.parse(localStorage.getItem('pt_users')) || [];
    return users.some(function (u) { return u.id === session.userId; });
  } catch (e) { return false; }
}

function ptGetUser() {
  try {
    var session = JSON.parse(localStorage.getItem('pt_session'));
    if (!session || !session.userId) return null;
    var users = JSON.parse(localStorage.getItem('pt_users')) || [];
    var user = users.find(function (u) { return u.id === session.userId; });
    if (!user) return null;
    return { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email };
  } catch (e) { return null; }
}

function navigateToTool(route) {
  var page = ROUTE_MAP[route];
  if (!page) return;
  if (ptIsLoggedIn()) {
    window.location.href = page;
  } else {
    window.location.href = 'login.html?redirect=' + encodeURIComponent(page);
  }
}

/* ── DOM READY ── */
document.addEventListener('DOMContentLoaded', function () {
  initHeader();
  initMobileMenu();
  initStudentToolsDropdown();
  initStudentLoginButtons();
  initDataRouteButtons();
  initGalleryToggle();
  initFAQ();
  initScrollReveal();
  initScrollNavLinks();
});

/* ============================================================
   HEADER — scroll shadow
   ============================================================ */
function initHeader() {
  var header = document.getElementById('site-header');
  window.addEventListener('scroll', function () {
    header.style.boxShadow = window.scrollY > 40
      ? '0 2px 16px rgba(0,0,0,0.12)'
      : '0 1px 8px rgba(0,0,0,0.08)';
  });
}

/* ============================================================
   MOBILE MENU
   FIX: added body scroll lock (body.nav-open) so the page
        doesn't scroll under the open drawer.
   FIX: close on outside tap and Escape key.
   ============================================================ */
function initMobileMenu() {
  var btn      = document.getElementById('mobile-menu-btn');
  var nav      = document.getElementById('mobile-nav');
  var menuIco  = document.getElementById('menu-icon');
  var closeIco = document.getElementById('close-icon');

  function openNav() {
    nav.classList.add('open');
    menuIco.style.display  = 'none';
    closeIco.style.display = '';
    btn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('nav-open');   /* lock scroll */
  }

  function closeNav() {
    nav.classList.remove('open');
    menuIco.style.display  = '';
    closeIco.style.display = 'none';
    btn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open'); /* restore scroll */
  }

  btn.addEventListener('click', function () {
    nav.classList.contains('open') ? closeNav() : openNav();
  });

  /* Close on any nav link tap */
  nav.querySelectorAll('.mobile-nav-link').forEach(function (link) {
    link.addEventListener('click', closeNav);
  });

  /* Close on outside tap */
  document.addEventListener('click', function (e) {
    if (nav.classList.contains('open') &&
        !nav.contains(e.target) &&
        !btn.contains(e.target)) {
      closeNav();
    }
  });

  /* Close on Escape */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNav();
  });
}

/* ============================================================
   STUDENT TOOLS DROPDOWN (desktop)
   ============================================================ */
function initStudentToolsDropdown() {
  var btn  = document.getElementById('student-tools-btn');
  var menu = document.getElementById('student-tools-menu');

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
  });

  document.addEventListener('click', function () {
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  });

  menu.addEventListener('click', function (e) { e.stopPropagation(); });
}

/* ============================================================
   data-route BUTTONS
   ============================================================ */
function initDataRouteButtons() {
  document.querySelectorAll('[data-route]').forEach(function (el) {
    el.addEventListener('click', function () {
      navigateToTool(el.getAttribute('data-route'));
    });
  });
}

/* ============================================================
   STUDENT LOGIN BUTTONS
   ============================================================ */
function initStudentLoginButtons() {
  function handleLoginClick() {
    if (ptIsLoggedIn()) {
      var user = ptGetUser();
      alert('You are signed in as ' + user.firstName + ' ' + user.lastName + '.');
    } else {
      window.location.href = 'login.html';
    }
  }

  var loginBtn = document.getElementById('student-login-btn');
  if (loginBtn) loginBtn.addEventListener('click', handleLoginClick);

  var mobileLoginBtn = document.getElementById('mobile-login-btn');
  if (mobileLoginBtn) {
    mobileLoginBtn.addEventListener('click', function () {
      document.getElementById('mobile-nav').classList.remove('open');
      document.getElementById('menu-icon').style.display  = '';
      document.getElementById('close-icon').style.display = 'none';
      document.body.classList.remove('nav-open');
      handleLoginClick();
    });
  }
}

/* ============================================================
   GALLERY TOGGLE
   ============================================================ */
function initGalleryToggle() {
  var btn      = document.getElementById('gallery-toggle');
  var extras   = document.querySelectorAll('.gallery-extra');
  var chevDown = document.getElementById('gallery-chevron-down');
  var chevUp   = document.getElementById('gallery-chevron-up');
  var expanded = false;

  btn.addEventListener('click', function () {
    expanded = !expanded;
    extras.forEach(function (el) {
      el.classList.toggle('hidden', !expanded);
    });
    btn.childNodes[0].textContent = expanded ? 'Show Less ' : 'View More ';
    chevDown.style.display = expanded ? 'none' : '';
    chevUp.style.display   = expanded ? ''     : 'none';
  });
}

/* ============================================================
   FAQ ACCORDION
   ============================================================ */
function initFAQ() {
  var list = document.getElementById('faq-list');
  FAQS.forEach(function (faq) {
    var item = document.createElement('div');
    item.className = 'faq-item';
    item.innerHTML =
      '<button class="faq-question" aria-expanded="false">' +
        '<span>' + escapeHtml(faq.q) + '</span>' +
        '<svg class="faq-chevron" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>' +
      '</button>' +
      '<div class="faq-answer" role="region">' +
        '<div class="faq-answer-inner">' + escapeHtml(faq.a) + '</div>' +
      '</div>';

    var qBtn = item.querySelector('.faq-question');
    qBtn.addEventListener('click', function () {
      var isOpen = item.classList.toggle('open');
      qBtn.setAttribute('aria-expanded', isOpen);
    });

    list.appendChild(item);
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ============================================================
   SCROLL REVEAL
   ============================================================ */
function initScrollReveal() {
  var els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('visible'); });
    return;
  }
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(function (el) { obs.observe(el); });
}

/* ============================================================
   SMOOTH SCROLL for nav links
   ============================================================ */
function initScrollNavLinks() {
  document.querySelectorAll('[data-scroll]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      var id     = el.getAttribute('data-scroll');
      var target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        var headerH = document.getElementById('site-header').offsetHeight;
        var top = target.getBoundingClientRect().top + window.scrollY - headerH - 8;
        window.scrollTo({ top: top, behavior: 'smooth' });
        /* Close mobile menu if open */
        document.getElementById('mobile-nav').classList.remove('open');
        document.getElementById('menu-icon').style.display  = '';
        document.getElementById('close-icon').style.display = 'none';
        document.body.classList.remove('nav-open');
      }
    });
  });
}
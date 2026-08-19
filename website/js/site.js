/* ==========================================================================
   SENNICARE — homepage JavaScript

   Five small jobs:
     1. The mobile menu (hamburger button)
     2. A border under the navigation bar once you scroll
     3. Closing the announcement bar, and remembering it stayed closed
     4. Fading sections in as they scroll into view
     5. Checking the sign-up form, then opening the visitor's email app

   The only line you may want to edit is SENNICARE_EMAIL, just below.
   ========================================================================== */

/* Where sign-ups should arrive. */
var SENNICARE_EMAIL = 'hello@sennicare.co.uk';


document.addEventListener('DOMContentLoaded', function () {

  /* ======================================================================
     1. MOBILE MENU
     ====================================================================== */
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var isOpen = navLinks.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      navToggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    });

    /* Tapping a link closes the menu again. */
    navLinks.addEventListener('click', function (event) {
      if (event.target.tagName === 'A') {
        navLinks.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Open menu');
      }
    });

    /* Escape closes it too, and puts focus back on the button. */
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && navLinks.classList.contains('is-open')) {
        navLinks.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.focus();
      }
    });
  }


  /* ======================================================================
     2. A LINE UNDER THE NAVIGATION BAR ONCE SCROLLED
     ====================================================================== */
  var nav = document.getElementById('nav');

  if (nav) {
    var updateNav = function () {
      nav.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    updateNav();
    window.addEventListener('scroll', updateNav, { passive: true });
  }


  /* ======================================================================
     3. THE ANNOUNCEMENT BAR
     Once closed, it stays closed on this device. localStorage is a small
     notepad the browser keeps for our site.
     ====================================================================== */
  var announce = document.getElementById('announce');
  var announceClose = document.getElementById('announceClose');
  var ANNOUNCE_KEY = 'sennicare-announce-closed';

  if (announce && announceClose) {
    try {
      if (window.localStorage.getItem(ANNOUNCE_KEY) === 'yes') {
        announce.hidden = true;
      }
    } catch (error) {
      /* Some browsers block storage in private mode. Not a problem - the bar
         simply shows every visit. */
    }

    announceClose.addEventListener('click', function () {
      announce.hidden = true;
      try { window.localStorage.setItem(ANNOUNCE_KEY, 'yes'); } catch (error) {}
    });
  }


  /* ======================================================================
     4. FADE SECTIONS IN AS THEY ARRIVE
     IntersectionObserver tells us when something scrolls into view. Anything
     with class="reveal" fades up once, then stays put.
     ====================================================================== */
  var revealItems = document.querySelectorAll('.reveal');
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var showEverything = function () {
    revealItems.forEach(function (item) { item.classList.add('is-visible'); });
  };

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    /* Show everything immediately: either the visitor asked for less motion,
       or their browser is too old for the effect. */
    showEverything();
  } else {
    var watcher = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          watcher.unobserve(entry.target);   // only animate once
        }
      });
    }, {
      /* A tiny threshold, so a section counts as "arrived" as soon as any of
         it appears. Being fussy here is how sections end up stuck invisible. */
      threshold: 0.01,
      rootMargin: '0px 0px -8% 0px'
    });

    revealItems.forEach(function (item) { watcher.observe(item); });

    /* Safety net. Whatever happens - a fast scroll, an odd browser, a printed
       page - nothing stays invisible for more than a few seconds. Content
       being readable always beats content arriving prettily. */
    window.setTimeout(showEverything, 2500);
    window.addEventListener('beforeprint', showEverything);
  }


  /* ======================================================================
     5. THE SIGN-UP FORM
     A website made only of files cannot send email by itself, so we check
     the details and then open the visitor's own email app with everything
     written out. See the note in index.html for the Formspree upgrade.
     ====================================================================== */
  var form = document.getElementById('signupForm');
  var formMessage = document.getElementById('formMessage');

  if (form && formMessage) {

    var showMessage = function (text, kind) {
      formMessage.textContent = text;
      formMessage.style.display = 'block';

      if (kind === 'error') {
        formMessage.style.background = 'rgba(220, 38, 38, 0.16)';
        formMessage.style.border = '1px solid rgba(255, 143, 169, 0.7)';
        formMessage.style.color = '#FFD7DF';
      } else {
        formMessage.style.background = 'rgba(13, 150, 105, 0.18)';
        formMessage.style.border = '1px solid rgba(74, 222, 128, 0.6)';
        formMessage.style.color = '#D9FBE9';
      }
    };

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var name = form.name.value.trim();
      var carehome = form.carehome.value.trim();
      var email = form.email.value.trim();

      if (!name || !carehome || !email) {
        showMessage('Please fill in all three boxes so we can set your account up properly.', 'error');
        return;
      }

      /* Some characters, an @, some characters, a dot, some characters. */
      var looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!looksLikeEmail) {
        showMessage('That email address does not look quite right. Please check it.', 'error');
        return;
      }

      var subject = 'Free account request - ' + carehome;
      var body =
        'Name: ' + name + '\n' +
        'Care home: ' + carehome + '\n' +
        'Email: ' + email + '\n\n' +
        'I would like a free Sennicare account.\n';

      window.location.href = 'mailto:' + SENNICARE_EMAIL +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);

      showMessage(
        'Thank you, ' + name + '. Your email app should now open with your request ready ' +
        'to send. If it does not, email us at ' + SENNICARE_EMAIL + '.',
        'success'
      );
    });
  }

});

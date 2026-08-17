/* ==========================================================================
   Sennicare website - JavaScript
   --------------------------------------------------------------------------
   This file does three small jobs:
     1. Opens and closes the mobile menu (the "hamburger" button)
     2. Adds a soft shadow to the navigation bar once you scroll down
     3. Checks the contact form is filled in, then opens the visitor's email
        program with their message ready to send to you

   You do not need to understand JavaScript to run the site. The only line you
   may want to edit is SENNICARE_EMAIL just below.
   ========================================================================== */

/* CHANGE THIS to the email address where you want enquiries to arrive. */
var SENNICARE_EMAIL = 'hello@sennicare.co.uk';


/* "DOMContentLoaded" means: wait until the page has loaded, then run this. */
document.addEventListener('DOMContentLoaded', function () {

  /* ======================================================================
     1. MOBILE MENU
     ====================================================================== */
  var navToggle = document.getElementById('navToggle');
  var navLinks  = document.getElementById('navLinks');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      // "toggle" adds the class if it's missing, removes it if it's there.
      var isOpen = navLinks.classList.toggle('is-open');

      // Keep the button's label and accessibility state in step.
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      navToggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    });

    // Close the menu again after someone taps one of the links.
    navLinks.addEventListener('click', function (event) {
      if (event.target.tagName === 'A') {
        navLinks.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Open menu');
      }
    });
  }


  /* ======================================================================
     2. SHADOW UNDER THE NAVIGATION BAR WHEN SCROLLED
     ====================================================================== */
  var navbar = document.getElementById('navbar');

  if (navbar) {
    // This function decides whether the shadow should be on or off.
    var updateNavbar = function () {
      if (window.scrollY > 10) {
        navbar.classList.add('is-scrolled');
      } else {
        navbar.classList.remove('is-scrolled');
      }
    };

    updateNavbar();                                   // check once on load
    window.addEventListener('scroll', updateNavbar);  // then on every scroll
  }


  /* ======================================================================
     3. CONTACT FORM
     A plain website (with no server behind it) cannot send an email on its
     own. So we do the next simplest thing: check the fields are filled in,
     then open the visitor's own email app with everything pre-written.

     If you would rather the form emailed you directly without opening the
     visitor's email app, see README.md - it is a free, one-line change.
     ====================================================================== */
  var form        = document.getElementById('contactForm');
  var formMessage = document.getElementById('formMessage');

  if (form && formMessage) {

    // Small helper so we can show a message in one line of code.
    var showMessage = function (text, type) {
      formMessage.textContent = text;
      formMessage.className = 'form__message is-visible is-' + type; // type = 'success' or 'error'
    };

    form.addEventListener('submit', function (event) {
      event.preventDefault();   // stop the browser reloading the page

      // Read what the visitor typed, trimming off any stray spaces.
      var name     = form.name.value.trim();
      var email    = form.email.value.trim();
      var carehome = form.carehome.value.trim();
      var message  = form.message.value.trim();

      // --- Check nothing important is missing ---
      if (!name || !email || !carehome || !message) {
        showMessage('Please fill in all four fields so we can help you properly.', 'error');
        return;   // stop here
      }

      // --- Check the email address looks like an email address ---
      // This pattern means: some characters, an @, some characters, a dot, some characters.
      var looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!looksLikeEmail) {
        showMessage('That email address does not look quite right. Please check it.', 'error');
        return;
      }

      // --- Build the email ---
      var subject = 'Free operational review request - ' + carehome;

      // "\n" means "start a new line". encodeURIComponent makes the text safe
      // to put inside a web link (spaces, ampersands and so on).
      var body =
        'Name: ' + name + '\n' +
        'Email: ' + email + '\n' +
        'Care home: ' + carehome + '\n\n' +
        'Message:\n' + message + '\n';

      var mailtoLink = 'mailto:' + SENNICARE_EMAIL +
                       '?subject=' + encodeURIComponent(subject) +
                       '&body='    + encodeURIComponent(body);

      // Open the visitor's email program with the message ready to send.
      window.location.href = mailtoLink;

      showMessage('Thank you, ' + name + '. Your email program should now open with ' +
                  'your enquiry ready to send. If it does not, please email us at ' +
                  SENNICARE_EMAIL + '.', 'success');
    });
  }

});

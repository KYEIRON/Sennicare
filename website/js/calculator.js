/* ==========================================================================
   Sennicare Savings Calculator
   --------------------------------------------------------------------------
   This file does the sums on savings-calculator.html.

   How it works, in plain English:
     1. When the page loads, we find each input box and slider.
     2. Every time the visitor types or drags, we run calculate() again.
     3. calculate() works out the savings and writes them onto the page.

   THE FIGURES YOU MIGHT WANT TO CHANGE are all in the SETTINGS block below.
   For example, change CONSOLIDATION_SAVING from 0.15 to 0.18 and the whole
   calculator switches from assuming a 15% saving to an 18% saving.
   ========================================================================== */


/* ==========================================================================
   SETTINGS - the assumptions behind the calculator
   (0.15 means 15%, 0.30 means 30%, and so on)
   ========================================================================== */
var SETTINGS = {
  CONSOLIDATION_SAVING: 0.15,   // 15% off consumables spend by consolidating suppliers
  ADMIN_TIME_SAVING:    0.30,   // 30% less time spent on ordering and admin
  WASTE_CUT:            0.50,   // we assume we can remove half of current waste
  HOURLY_RATE:          15,     // £15 per hour, used to value the time saved

  /* Used for the "reduce from X suppliers to about Y" recommendation.
     We suggest keeping roughly 40% of the current suppliers, but never
     fewer than 3 (a home always needs a few) - see MIN_CORE_SUPPLIERS. */
  CORE_SUPPLIER_SHARE:  0.40,
  MIN_CORE_SUPPLIERS:   3,

  /* The example figures used when the page first loads, and when someone
     clicks "Reset to example figures". */
  DEFAULTS: { suppliers: 12, spend: 8000, hours: 10, waste: 8 },

  /* Where enquiries from this page should go. */
  EMAIL: 'hello@sennicare.co.uk'
};


/* ==========================================================================
   NUMBER FORMATTING HELPERS
   ========================================================================== */

/* Turns 12345.67 into "£12,346" (pounds, with commas, no pence).
   We round to whole pounds because these are estimates, not invoices. */
function formatPounds(amount) {
  return '£' + Math.round(amount).toLocaleString('en-GB');
}

/* Turns 156 into "156 hours" (and 1 into "1 hour"). */
function formatHours(hours) {
  var rounded = Math.round(hours);
  return rounded.toLocaleString('en-GB') + (rounded === 1 ? ' hour' : ' hours');
}

/* Safely reads a number from an input box.
   If the box is empty or contains something odd, we treat it as 0 so the
   calculator never shows "NaN" (which means "not a number"). */
function readNumber(element) {
  var value = parseFloat(element.value);
  if (isNaN(value) || value < 0) { return 0; }
  return value;
}


/* ==========================================================================
   MAIN CODE - runs once the page has loaded
   ========================================================================== */
document.addEventListener('DOMContentLoaded', function () {

  /* ---- Find the four inputs. If they're not on this page, stop here. ---- */
  var inputs = {
    suppliers: document.getElementById('suppliers'),
    spend:     document.getElementById('spend'),
    hours:     document.getElementById('hours'),
    waste:     document.getElementById('waste')
  };
  if (!inputs.suppliers || !inputs.spend || !inputs.hours || !inputs.waste) {
    return;   // not the calculator page - nothing to do
  }

  /* ---- Find the places on the page where we write the answers ---- */
  var out = {
    suppliersValue:  document.getElementById('suppliersValue'),
    wasteValue:      document.getElementById('wasteValue'),
    wasteHint:       document.getElementById('wasteHint'),
    recommendBox:    document.getElementById('recommendBox'),
    consolidation:   document.getElementById('resultConsolidation'),
    waste:           document.getElementById('resultWaste'),
    wasteNote:       document.getElementById('resultWasteNote'),
    hours:           document.getElementById('resultHours'),
    hoursNote:       document.getElementById('resultHoursNote'),
    total:           document.getElementById('resultTotal'),
    totalNote:       document.getElementById('resultTotalNote'),
    ctaBookReview:   document.getElementById('ctaBookReview'),
    ctaEmailResults: document.getElementById('ctaEmailResults')
  };


  /* ======================================================================
     THE SUMS
     Takes the four answers, returns all the figures we want to show.
     ====================================================================== */
  function work_out_savings(suppliers, monthlySpend, weeklyHours, wastePercent) {

    // Turn the monthly spend into a yearly figure, and the % into a decimal.
    var annualSpend  = monthlySpend * 12;
    var wasteShare   = wastePercent / 100;        // e.g. 8% becomes 0.08

    // 1. Saving from using fewer, bigger suppliers
    var consolidationSaving = annualSpend * SETTINGS.CONSOLIDATION_SAVING;

    // 2. Saving from cutting waste in half
    var currentWasteCost = annualSpend * wasteShare;
    var wasteSaving      = currentWasteCost * SETTINGS.WASTE_CUT;

    // 3. Staff hours given back each year, and what those hours are worth
    var annualAdminHours = weeklyHours * 52;
    var hoursSaved       = annualAdminHours * SETTINGS.ADMIN_TIME_SAVING;
    var timeValue        = hoursSaved * SETTINGS.HOURLY_RATE;

    // 4. Everything added together
    var totalBenefit = consolidationSaving + wasteSaving + timeValue;

    // 5. How many core suppliers we'd suggest keeping.
    //    Math.ceil rounds up; Math.max keeps it at 3 or more; Math.min makes
    //    sure we never suggest MORE suppliers than they already have.
    var coreSuppliers = Math.ceil(suppliers * SETTINGS.CORE_SUPPLIER_SHARE);
    coreSuppliers = Math.max(coreSuppliers, SETTINGS.MIN_CORE_SUPPLIERS);
    coreSuppliers = Math.min(coreSuppliers, suppliers);

    return {
      annualSpend:         annualSpend,
      consolidationSaving: consolidationSaving,
      currentWasteCost:    currentWasteCost,
      wasteSaving:         wasteSaving,
      hoursSaved:          hoursSaved,
      timeValue:           timeValue,
      totalBenefit:        totalBenefit,
      coreSuppliers:       coreSuppliers
    };
  }


  /* ======================================================================
     WRITING THE ANSWERS ONTO THE PAGE
     ====================================================================== */
  function calculate() {

    // --- Read what the visitor has entered ---
    var suppliers    = readNumber(inputs.suppliers);
    var monthlySpend = readNumber(inputs.spend);
    var weeklyHours  = readNumber(inputs.hours);
    var wastePercent = readNumber(inputs.waste);

    // --- Do the maths ---
    var r = work_out_savings(suppliers, monthlySpend, weeklyHours, wastePercent);

    // --- Update the live labels next to the two sliders ---
    out.suppliersValue.textContent = suppliers + (suppliers === 1 ? ' supplier' : ' suppliers');
    out.wasteValue.textContent     = wastePercent + '%';

    // Show the £ value of their waste, so the percentage means something real
    out.wasteHint.textContent = wastePercent === 0
      ? 'Stock thrown away, expired or over-ordered, as a share of your spend.'
      : 'That is about ' + formatPounds(r.currentWasteCost) + ' of stock wasted a year.';

    // --- The plain-English recommendation ---
    if (suppliers <= SETTINGS.MIN_CORE_SUPPLIERS) {
      out.recommendBox.innerHTML =
        'With just <strong>' + suppliers + '</strong> supplier' + (suppliers === 1 ? '' : 's') +
        ', your supply chain is already tight. The bigger wins for you are likely to be ' +
        'in pricing, stock control and admin time &mdash; all of which we review too.';
    } else {
      out.recommendBox.innerHTML =
        'We would typically consolidate <strong>' + suppliers + ' suppliers</strong> down to ' +
        'around <strong>' + r.coreSuppliers + ' core partners</strong>, on an annual consumables ' +
        'spend of <strong>' + formatPounds(r.annualSpend) + '</strong>.';
    }

    // --- The three results and the total ---
    out.consolidation.textContent = formatPounds(r.consolidationSaving);

    out.waste.textContent = formatPounds(r.wasteSaving);
    out.wasteNote.textContent = wastePercent === 0
      ? 'Set your waste estimate above to include this'
      : 'Based on halving ' + formatPounds(r.currentWasteCost) + ' of current waste';

    out.hours.textContent = formatHours(r.hoursSaved);
    out.hoursNote.textContent =
      'A ' + (SETTINGS.ADMIN_TIME_SAVING * 100) + '% cut in admin time, worth ' +
      formatPounds(r.timeValue) + ' at ' + formatPounds(SETTINGS.HOURLY_RATE) + ' per hour';

    out.total.textContent = formatPounds(r.totalBenefit);
    out.totalNote.textContent = 'including ' + formatHours(r.hoursSaved) + ' of staff time given back';

    // --- Keep the two email links up to date with these figures ---
    updateEmailLinks(suppliers, monthlySpend, weeklyHours, wastePercent, r);
  }


  /* ======================================================================
     THE EMAIL LINKS
     A "mailto:" link opens the visitor's own email program with the subject
     and message already written. encodeURIComponent makes the text safe to
     put inside a link. "%0D%0A" is how you write a new line in a mailto link.
     ====================================================================== */
  function updateEmailLinks(suppliers, monthlySpend, weeklyHours, wastePercent, r) {

    // The summary of their figures, used in both emails.
    var summary = [
      'My figures:',
      '- Suppliers used: ' + suppliers,
      '- Monthly consumables spend: ' + formatPounds(monthlySpend),
      '- Weekly ordering/admin hours: ' + weeklyHours,
      '- Estimated stock waste: ' + wastePercent + '%',
      '',
      'Sennicare calculator estimate:',
      '- Supply consolidation saving: ' + formatPounds(r.consolidationSaving) + ' a year',
      '- Waste reduction saving: ' + formatPounds(r.wasteSaving) + ' a year',
      '- Staff time given back: ' + formatHours(r.hoursSaved) + ' a year (' + formatPounds(r.timeValue) + ')',
      '- Total estimated annual benefit: ' + formatPounds(r.totalBenefit),
      '',
      'Suggested consolidation: ' + suppliers + ' suppliers down to about ' + r.coreSuppliers + ' core partners.'
    ].join('\r\n');

    // Link 1: the big magenta button - an enquiry addressed to Sennicare
    var bookSubject = 'Free operational review request - estimated ' +
                      formatPounds(r.totalBenefit) + ' annual benefit';
    var bookBody =
      'Hello Sennicare,\r\n\r\n' +
      'I have used your savings calculator and would like a detailed breakdown, ' +
      'plus a free operational review of my home.\r\n\r\n' +
      summary + '\r\n\r\n' +
      'My care home: \r\n' +
      'My name: \r\n' +
      'Best contact number: \r\n';

    out.ctaBookReview.setAttribute('href',
      'mailto:' + SETTINGS.EMAIL +
      '?subject=' + encodeURIComponent(bookSubject) +
      '&body='    + encodeURIComponent(bookBody));

    // Link 2: the small link - the results emailed to whoever they choose,
    // with no address filled in, so it goes to themselves or a colleague.
    var resultsSubject = 'Sennicare savings estimate - ' + formatPounds(r.totalBenefit) + ' a year';
    var resultsBody =
      'Sennicare savings estimate\r\n' +
      '(from sennicare.co.uk/savings-calculator.html)\r\n\r\n' +
      summary + '\r\n\r\n' +
      'These are estimates based on typical results across UK care homes, not a ' +
      'guarantee. A free operational review gives exact figures from real invoices.\r\n\r\n' +
      'Sennicare - Empowering Caregivers\r\n' +
      SETTINGS.EMAIL + '\r\n';

    out.ctaEmailResults.setAttribute('href',
      'mailto:?subject=' + encodeURIComponent(resultsSubject) +
      '&body='           + encodeURIComponent(resultsBody));
  }


  /* ======================================================================
     LISTEN FOR CHANGES
     "input" fires the moment someone types a character or moves a slider,
     so the results update live - no Calculate button needed.
     ====================================================================== */
  Object.keys(inputs).forEach(function (key) {
    inputs[key].addEventListener('input', calculate);
  });

  /* ---- The "Reset to example figures" button ---- */
  var resetButton = document.getElementById('calcReset');
  if (resetButton) {
    resetButton.addEventListener('click', function () {
      inputs.suppliers.value = SETTINGS.DEFAULTS.suppliers;
      inputs.spend.value     = SETTINGS.DEFAULTS.spend;
      inputs.hours.value     = SETTINGS.DEFAULTS.hours;
      inputs.waste.value     = SETTINGS.DEFAULTS.waste;
      calculate();   // redraw the results with the example figures
    });
  }

  /* ---- Work out the figures once, straight away, so the page never shows
          empty results when it first loads. ---- */
  calculate();

});

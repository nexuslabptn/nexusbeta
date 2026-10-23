/**
 * Animata — Shiny Button Component (components/ui/shiny-button.js)
 * Enhances a button with continuous/hover light shimmer and ripple click waves.
 */
(function () {
  function makeShinyButton(button, options) {
    if (!button || button._shinyAttached) return;
    button._shinyAttached = true;
    button.classList.add('animata-shiny-button');

    const opts = Object.assign({
      duration: '3.5s',
      magnetic: false
    }, options);

    if (opts.duration) {
      button.style.setProperty('--animata-shiny-duration', opts.duration);
    }
    if (opts.magnetic) {
      button.classList.add('animata-magnetic');
    }

    if (window.NexusMotion) {
      window.NexusMotion.initShinyButtons();
      if (opts.magnetic) window.NexusMotion.initMagneticButtons();
    }
  }

  window.createShinyButton = makeShinyButton;
})();

/**
 * Motion Primitives — Spotlight Card Component (components/ui/spotlight-card.js)
 * Wraps or enhances a container with a smooth cursor-following radial light beam.
 */
(function () {
  function attachSpotlight(element, options) {
    if (!element || element._spotlightAttached) return;
    element._spotlightAttached = true;
    element.classList.add('mp-spotlight-card');

    const opts = Object.assign({
      size: 320,
      color: null
    }, options);

    if (opts.size) {
      element.style.setProperty('--mp-spotlight-size', opts.size + 'px');
    }
    if (opts.color) {
      element.style.setProperty('--mp-spotlight-color', opts.color);
    }

    if (window.NexusMotion && window.NexusMotion.initSpotlights) {
      window.NexusMotion.initSpotlights();
    }
  }

  window.createSpotlightCard = attachSpotlight;
})();

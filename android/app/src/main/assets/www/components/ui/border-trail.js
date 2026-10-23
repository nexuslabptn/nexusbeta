/**
 * Motion Primitives — Border Trail Component (components/ui/border-trail.js)
 * Moving light beam around card borders using conic gradient or CSS offset-path.
 */
(function () {
  function applyBorderTrail(element, options) {
    if (!element || element._borderTrailAttached) return;
    element._borderTrailAttached = true;

    const opts = Object.assign({
      color: '#00f2fe',
      duration: '5s'
    }, options);

    element.classList.add('mp-conic-trail');
    element.style.setProperty('--mp-border-trail-color', opts.color);
    element.style.setProperty('--mp-border-trail-duration', opts.duration);
  }

  window.createBorderTrail = applyBorderTrail;
})();

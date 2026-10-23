/**
 * Motion Primitives — Text Effect Component (components/ui/text-effect.js)
 * Staggered word/char reveal with blur, scale and spring easing.
 */
(function () {
  function applyTextEffect(element) {
    if (!element || element._textEffectAttached) return;
    element._textEffectAttached = true;
    element.classList.add('mp-text-reveal');

    if (window.NexusMotion && window.NexusMotion.initTextEffects) {
      window.NexusMotion.initTextEffects();
    }
  }

  window.createTextEffect = applyTextEffect;
})();

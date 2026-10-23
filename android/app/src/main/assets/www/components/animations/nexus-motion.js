/**
 * NEXUSLAB - SCIENTIFIC VIRTUAL SIMULATION SUITE
 * High-Performance Modular Motion Engine (components/animations/nexus-motion.js)
 *
 * Implements interactive animation patterns inspired by:
 *  - Motion Primitives (Julien Thibeaut / ibelick)
 *  - Animata (Codse / animata.design)
 *
 * Capabilities:
 *  1. Spotlight Cursor Tracking
 *  2. 3D Perspective Tilt with Dynamic Glare
 *  3. Text Effect Staggered Blur Reveal
 *  4. In-View Scroll Reveal with IntersectionObserver
 *  5. Sliding Segmented Tabs Slider
 *  6. Shiny Button Shimmer & Coordinate-Accurate Ripple Waves
 *  7. Number Ticker Eased Counters
 *  8. Magnetic Button Physics
 *
 * Accessibility & Performance:
 *  - Automatically pauses/simplifies when prefers-reduced-motion is enabled
 *  - Disables mouse-tilt on touch/mobile devices
 *  - 60 FPS requestAnimationFrame throttling
 *  - Zero layout thrashing
 */

(function (window, document) {
  'use strict';

  // Check user motion preferences
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(pointer: fine)').matches;

  const NexusMotion = {
    initialized: false,

    /**
     * Master Initialization
     */
    init: function () {
      if (this.initialized) return;
      this.initialized = true;

      this.initTextEffects();
      this.initSpotlights();
      this.initTilts();
      this.initScrollReveal();
      this.initShinyButtons();
      this.initSlidingTabs();
      this.initNumberTickers();
      this.initMagneticButtons();

      // Listen for theme toggle events to update dynamic visual states
      window.addEventListener('nexus-theme-changed', function () {
        NexusMotion.refreshTabs();
      });

      // Handle window resize for responsive tab sliders
      let resizeTimer = null;
      window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
          NexusMotion.refreshTabs();
        }, 150);
      });
    },

    /**
     * 1. MOTION PRIMITIVES — SPOTLIGHT EFFECT
     * Dynamically casts a subtle radial light cone following the cursor
     */
    initSpotlights: function (selector) {
      if (prefersReducedMotion || !isFinePointer) return;
      const targetSelector = selector || '.mp-spotlight-card';
      const cards = document.querySelectorAll(targetSelector);

      cards.forEach(function (card) {
        if (card._mpSpotlightInit) return;
        card._mpSpotlightInit = true;

        let isHovered = false;

        card.addEventListener('mouseenter', function () {
          isHovered = true;
          card.style.setProperty('--spotlight-opacity', '1');
        });

        card.addEventListener('mousemove', function (e) {
          if (!isHovered) return;
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          card.style.setProperty('--mouse-x', x + 'px');
          card.style.setProperty('--mouse-y', y + 'px');
        });

        card.addEventListener('mouseleave', function () {
          isHovered = false;
          card.style.setProperty('--spotlight-opacity', '0');
        });
      });
    },

    /**
     * 2. MOTION PRIMITIVES — 3D PERSPECTIVE TILT WITH GLARE
     * Responsive 3D parallax tilt with spring reset
     */
    initTilts: function (selector) {
      if (prefersReducedMotion || !isFinePointer) return;
      const targetSelector = selector || '.mp-tilt-card';
      const elements = document.querySelectorAll(targetSelector);

      elements.forEach(function (el) {
        if (el._mpTiltInit) return;
        el._mpTiltInit = true;

        // Ensure glare overlay exists
        let glare = el.querySelector('.mp-glare-overlay');
        if (!glare) {
          glare = document.createElement('div');
          glare.className = 'mp-glare-overlay';
          el.appendChild(glare);
        }

        const maxTilt = parseFloat(el.getAttribute('data-tilt-max')) || 6;
        let ticking = false;

        el.addEventListener('mousemove', function (e) {
          if (ticking) return;
          ticking = true;

          requestAnimationFrame(function () {
            const rect = el.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const rotateX = ((y / height) - 0.5) * -maxTilt;
            const rotateY = ((x / width) - 0.5) * maxTilt;

            el.style.transform = 'perspective(1000px) rotateX(' + rotateX.toFixed(2) + 'deg) rotateY(' + rotateY.toFixed(2) + 'deg) scale3d(1.015, 1.015, 1.015)';

            // Position glare
            const glareX = ((x / width) * 100).toFixed(1) + '%';
            const glareY = ((y / height) * 100).toFixed(1) + '%';
            el.style.setProperty('--glare-x', glareX);
            el.style.setProperty('--glare-y', glareY);
            el.style.setProperty('--glare-opacity', '0.25');

            ticking = false;
          });
        });

        el.addEventListener('mouseleave', function () {
          el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
          el.style.setProperty('--glare-opacity', '0');
        });
      });
    },

    /**
     * 3. MOTION PRIMITIVES — TEXT EFFECT
     * Splits text into staggered words with blur, scale and vertical reveal,
     * carefully preserving nested HTML tags (like gradient spans or line breaks).
     */
    initTextEffects: function (selector) {
      const targetSelector = selector || '.mp-text-reveal';
      const elements = document.querySelectorAll(targetSelector);

      elements.forEach(function (el) {
        if (el._mpTextInit) return;
        el._mpTextInit = true;

        if (prefersReducedMotion) {
          el.style.opacity = '1';
          return;
        }

        // Helper to process a text node into staggered word spans
        let wordCounter = 0;
        function processNode(node) {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            if (!text.trim()) return null;

            const words = text.split(/(\s+)/);
            const fragment = document.createDocumentFragment();

            words.forEach(function (part) {
              if (/\s+/.test(part)) {
                fragment.appendChild(document.createTextNode(part));
              } else if (part.length > 0) {
                const span = document.createElement('span');
                span.className = 'mp-text-word';
                span.textContent = part;
                span.style.animationDelay = (wordCounter * 0.045 + 0.04).toFixed(3) + 's';
                wordCounter++;
                fragment.appendChild(span);
              }
            });
            return fragment;
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName.toLowerCase() === 'br') return null;
            // Process child nodes recursively
            const children = Array.from(node.childNodes);
            children.forEach(function (child) {
              const replacement = processNode(child);
              if (replacement) {
                node.replaceChild(replacement, child);
              }
            });
            return null;
          }
          return null;
        }

        const childNodes = Array.from(el.childNodes);
        childNodes.forEach(function (child) {
          const replacement = processNode(child);
          if (replacement) {
            el.replaceChild(replacement, child);
          }
        });
      });
    },

    /**
     * 4. MOTION PRIMITIVES — IN-VIEW SCROLL REVEAL
     * IntersectionObserver for stagger-revealing cards, badges, and grids
     */
    initScrollReveal: function (selector) {
      const targetSelector = selector || '.mp-scroll-reveal';
      const elements = document.querySelectorAll(targetSelector);

      if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
        elements.forEach(function (el) {
          el.classList.add('mp-is-revealed');
        });
        return;
      }

      const observer = new IntersectionObserver(
        function (entries, obs) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('mp-is-revealed');
              obs.unobserve(entry.target);
            }
          });
        },
        {
          rootMargin: '0px 0px -50px 0px',
          threshold: 0.12,
        }
      );

      elements.forEach(function (el) {
        observer.observe(el);
      });
    },

    /**
     * 5. MOTION PRIMITIVES — SLIDING SEGMENTED TABS
     * Sliding pill behind active filter tabs with spring physics
     */
    initSlidingTabs: function (containerSelector) {
      const targetSelector = containerSelector || '.mp-tabs-container';
      const containers = document.querySelectorAll(targetSelector);

      containers.forEach(function (container) {
        let slider = container.querySelector('.mp-tabs-slider');
        if (!slider) {
          slider = document.createElement('div');
          slider.className = 'mp-tabs-slider';
          container.insertBefore(slider, container.firstChild);
        }

        function updateSlider() {
          const activeTab =
            container.querySelector('.mp-tab-active') ||
            container.querySelector('[aria-selected="true"]') ||
            container.querySelector('.active') ||
            container.querySelector('button.bg-neonCyan\\/20') ||
            container.querySelector('button.bg-cyan-500');

          if (!activeTab) {
            slider.style.opacity = '0';
            return;
          }

          const containerRect = container.getBoundingClientRect();
          const tabRect = activeTab.getBoundingClientRect();

          const left = tabRect.left - containerRect.left + container.scrollLeft;
          const top = tabRect.top - containerRect.top;
          const width = tabRect.width;
          const height = tabRect.height;

          slider.style.opacity = '1';
          slider.style.width = width + 'px';
          slider.style.height = height + 'px';
          slider.style.transform = 'translate3d(' + left + 'px, ' + top + 'px, 0)';
        }

        container._updateSlider = updateSlider;

        // Attach listeners to tabs
        const tabs = container.querySelectorAll('button, a');
        tabs.forEach(function (tab) {
          tab.classList.add('mp-tab-item');
          tab.addEventListener('click', function () {
            setTimeout(updateSlider, 20);
          });
        });

        // Initial alignment
        setTimeout(updateSlider, 50);
      });
    },

    refreshTabs: function () {
      const containers = document.querySelectorAll('.mp-tabs-container');
      containers.forEach(function (c) {
        if (typeof c._updateSlider === 'function') {
          c._updateSlider();
        }
      });
    },

    /**
     * 6. ANIMATA — SHINY BUTTON & TACTILE RIPPLE WAVES
     * Shimmering light sweep & coordinate-accurate click ripple
     */
    initShinyButtons: function (selector) {
      const targetSelector = selector || '.animata-shiny-button';
      const buttons = document.querySelectorAll(targetSelector);

      buttons.forEach(function (btn) {
        if (btn._animataShinyInit) return;
        btn._animataShinyInit = true;

        btn.addEventListener('pointerdown', function (e) {
          if (prefersReducedMotion) return;
          const rect = btn.getBoundingClientRect();
          const size = Math.max(rect.width, rect.height) * 2;
          const x = e.clientX - rect.left - size / 2;
          const y = e.clientY - rect.top - size / 2;

          const ripple = document.createElement('span');
          ripple.className = 'animata-ripple';
          ripple.style.width = size + 'px';
          ripple.style.height = size + 'px';
          ripple.style.left = x + 'px';
          ripple.style.top = y + 'px';

          // Light mode adaptive ripple color
          const isLight = document.documentElement.classList.contains('light');
          if (isLight) {
            ripple.style.background = 'rgba(2, 132, 199, 0.25)';
          }

          btn.appendChild(ripple);

          setTimeout(function () {
            if (ripple && ripple.parentNode) {
              ripple.parentNode.removeChild(ripple);
            }
          }, 600);
        });
      });
    },

    /**
     * 7. ANIMATA — NUMBER TICKER / COUNTER TRANSITIONS
     * Smooth easeOutExpo numeric transition upon viewport entry
     */
    initNumberTickers: function (selector) {
      const targetSelector = selector || '.animata-counter, .nexus-counter';
      const counters = document.querySelectorAll(targetSelector);

      if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
        counters.forEach(function (c) {
          const target = c.getAttribute('data-target');
          if (target) c.textContent = target;
        });
        return;
      }

      function easeOutExpo(x) {
        return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
      }

      function animateCounter(el) {
        const target = parseFloat(el.getAttribute('data-target')) || 0;
        const duration = 1400; // ms
        const startTime = performance.now();

        function update(currentTime) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easedProgress = easeOutExpo(progress);
          const current = Math.floor(easedProgress * target);

          el.textContent = current;

          if (progress < 1) {
            requestAnimationFrame(update);
          } else {
            el.textContent = target;
          }
        }

        requestAnimationFrame(update);
      }

      const observer = new IntersectionObserver(
        function (entries, obs) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              animateCounter(entry.target);
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.25 }
      );

      counters.forEach(function (c) {
        observer.observe(c);
      });
    },

    /**
     * 8. ANIMATA — MAGNETIC BUTTON PHYSICS
     * Gentle attraction pull toward cursor
     */
    initMagneticButtons: function (selector) {
      if (prefersReducedMotion || !isFinePointer) return;
      const targetSelector = selector || '.animata-magnetic';
      const elements = document.querySelectorAll(targetSelector);

      elements.forEach(function (el) {
        if (el._animataMagneticInit) return;
        el._animataMagneticInit = true;

        el.addEventListener('mousemove', function (e) {
          const rect = el.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;

          const deltaX = (e.clientX - centerX) * 0.25;
          const deltaY = (e.clientY - centerY) * 0.25;

          el.style.transform = 'translate3d(' + deltaX.toFixed(1) + 'px, ' + deltaY.toFixed(1) + 'px, 0)';
        });

        el.addEventListener('mouseleave', function () {
          el.style.transform = 'translate3d(0, 0, 0)';
        });
      });
    },
  };

  // Expose globally
  window.NexusMotion = NexusMotion;

  // Auto-init on DOM readiness
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      NexusMotion.init();
    });
  } else {
    NexusMotion.init();
  }
})(window, document);

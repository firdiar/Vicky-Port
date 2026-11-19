/* Genesis — motion and interaction layer.
   Plain ES2019, no dependencies. Works on every page: it reads the DOM, tags
   what should animate, and leaves the page complete and readable if it never
   runs (the stylesheet only hides things when <html> carries `js`).

   Switches, in order of precedence:
     ?motion=off        — no animation at all (also used for screenshot tests)
     prefers-reduced-motion: reduce — same
     anything else      — full motion

   app.js runs first (same DOMContentLoaded queue), so content it renders is
   already in the DOM when this file tags it. */

(function () {
  "use strict";

  var root = document.documentElement;
  root.dataset.motionReady = "1";

  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) {
    return Array.prototype.slice.call((el || document).querySelectorAll(sel));
  };
  var raf = function (fn) { return window.requestAnimationFrame(fn); };

  var reduceQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  var fineQ = window.matchMedia("(hover: hover) and (pointer: fine)");

  /* Containers: children are revealed one after another. */
  var GROUPS = [
    ".hero__copy",
    ".split",
    ".cert-grid",
    ".focus-grid",
    ".skill-groups",
    ".contact",
    ".footer__grid",
  ];

  /* Single elements that reveal on their own. */
  var LEAVES = [
    ".section-head",
    ".timeline__item",
    ".edu",
    ".award",
    ".hero__inner > .sheet",
    ".footer__bottom",
  ];

  /* Already on screen when the page loads — animate immediately, never
     wait for a scroll that may never happen. */
  var IMMEDIATE = ".hero__copy, .hero__inner > .sheet";

  var MAX_STAGGER = 8;

  /* --------------------------------------------------------------- reveal */

  function staggerGroup(group) {
    Array.prototype.forEach.call(group.children, function (child, i) {
      child.style.setProperty("--reveal-i", String(Math.min(i, MAX_STAGGER)));
    });
  }

  function autoTag() {
    GROUPS.forEach(function (sel) {
      $$(sel).forEach(function (el) {
        if (el.closest("dialog")) return;
        if (el.hasAttribute("data-reveal-group")) {
          staggerGroup(el);
          return;
        }
        if (el.closest("[data-reveal-group]")) return;
        el.setAttribute("data-reveal-group", "");
        staggerGroup(el);
      });
    });

    LEAVES.forEach(function (sel) {
      $$(sel).forEach(function (el) {
        if (el.closest("dialog")) return;
        if (el.hasAttribute("data-reveal") || el.hasAttribute("data-reveal-group")) return;
        if (el.closest("[data-reveal-group]")) return;
        el.setAttribute("data-reveal", "up");
      });
    });
  }

  function initReveal() {
    autoTag();

    var targets = $$("[data-reveal], [data-reveal-group]");
    if (!targets.length) return;

    var vh = window.innerHeight || 800;
    var observer = "IntersectionObserver" in window
      ? new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (!entry.isIntersecting) return;
              entry.target.classList.add("is-in");
              observer.unobserve(entry.target);
            });
          },
          { rootMargin: "0px", threshold: 0 }
        )
      : null;

    targets.forEach(function (el) {
      if (el.closest("dialog")) return;

      /* Anything already inside the viewport when this runs is shown without
         a transition: setting the attribute and the class in the same task
         means the hidden state is never painted, so there is no flicker. */
      var rect = el.getBoundingClientRect();
      var onScreen = rect.top < vh && rect.bottom > 0;

      if (el.matches(IMMEDIATE)) {
        raf(function () { el.classList.add("is-in"); });
        return;
      }

      if (onScreen) {
        el.classList.add("is-in");
        return;
      }

      if (observer) observer.observe(el);
      else el.classList.add("is-in");
    });
  }

  /* ---------------------------------------------------------------- words */

  function initWords() {
    var titles = $$(".hero__title");
    titles.forEach(function (title) {
      try {
        var words = title.textContent.trim().split(/\s+/);
        if (words.length < 2) return;

        var frag = document.createDocumentFragment();
        words.forEach(function (word, i) {
          var span = document.createElement("span");
          span.className = "w";
          span.style.setProperty("--wi", String(i));
          span.textContent = word;
          frag.appendChild(span);
          if (i < words.length - 1) frag.appendChild(document.createTextNode(" "));
        });

        title.textContent = "";
        title.appendChild(frag);
        title.classList.add("is-split");

        /* Two frames so the offset position is painted once before the words
           glide up; the timer is a safety net if rAF never fires. */
        raf(function () {
          raf(function () { title.classList.add("is-in"); });
        });
        window.setTimeout(function () { title.classList.add("is-in"); }, 700);
      } catch (e) {
        title.classList.remove("is-split");
      }
    });
  }

  /* -------------------------------------------------------------- count-up */

  function countUp(el, target, duration) {
    var isYear = target > 1000;
    var from = isYear ? Math.max(0, target - 6) : 0;
    var start = null;

    var ease = function (t) { return 1 - Math.pow(1 - t, 4); };

    var step = function (now) {
      if (start === null) start = now;
      var k = Math.min(1, (now - start) / duration);
      el.textContent = String(Math.round(from + (target - from) * ease(k)));
      if (k < 1) raf(step);
      else el.textContent = String(target);
    };

    raf(step);

    /* If the tab is hidden, frames stop; land on the final value anyway. */
    window.setTimeout(function () { el.textContent = String(target); }, duration + 300);
  }

  function initCountUp() {
    var stats = $(".hero__stats");
    if (!stats || !("IntersectionObserver" in window)) return;

    /* Years (2020, 1998…) are left alone: a rolling year reads as a typo.
       Small counts animate from zero. */
    var values = $$(".hero-stat__value", stats).map(function (el) {
      var target = parseInt(el.textContent.replace(/[^\d]/g, ""), 10);
      if (!isFinite(target) || target > 999) return null;
      el.textContent = "0";
      return { el: el, target: target };
    }).filter(Boolean);

    if (!values.length) return;

    var started = false;

    /* If the observer never fires (an odd embed, a stopped frame loop), put the
       real figures back rather than leaving zeroes on the page. */
    window.setTimeout(function () {
      if (started) return;
      values.forEach(function (item) { item.el.textContent = String(item.target); });
    }, 2400);

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          started = true;
          observer.disconnect();
          window.setTimeout(function () {
            values.forEach(function (item) {
              countUp(item.el, item.target, item.target > 1000 ? 1000 : 760);
            });
          }, 240);
        });
      },
      { threshold: 0.4 }
    );

    observer.observe(stats);
  }

  /* ---------------------------------------------------------- spotlight */

  function initSpotlight() {
    var cards = $$(".cert, .focus, .sheet, .contact, .card--hover, .kit-list__row");
    if (!cards.length) return;

    cards.forEach(function (el) { el.classList.add("spot"); });

    var lit = null;
    var queued = false;
    var cx = 0;
    var cy = 0;

    document.addEventListener("pointermove", function (event) {
      var el = event.target.closest ? event.target.closest(".spot") : null;

      if (el !== lit) {
        if (lit) lit.dataset.lit = "false";
        lit = el;
        if (lit) lit.dataset.lit = "true";
      }

      if (!lit) return;
      cx = event.clientX;
      cy = event.clientY;

      if (queued) return;
      queued = true;
      raf(function () {
        queued = false;
        if (!lit) return;
        var rect = lit.getBoundingClientRect();
        lit.style.setProperty("--mx", (cx - rect.left).toFixed(0) + "px");
        lit.style.setProperty("--my", (cy - rect.top).toFixed(0) + "px");
      });
    }, { passive: true });
  }

  /* --------------------------------------------------------------- tilt */

  function initTilt() {
    var sheet = $(".hero__inner > .sheet");
    if (!sheet) return;

    sheet.classList.add("tilt");
    var rect = null;

    sheet.addEventListener("pointerenter", function () {
      rect = sheet.getBoundingClientRect();
      sheet.dataset.tilting = "true";
    });

    sheet.addEventListener("pointermove", function (event) {
      if (!rect) rect = sheet.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      var px = (event.clientX - rect.left) / rect.width;
      var py = (event.clientY - rect.top) / rect.height;

      sheet.style.setProperty("--tilt-x", ((0.5 - py) * 5).toFixed(2) + "deg");
      sheet.style.setProperty("--tilt-y", ((px - 0.5) * 6).toFixed(2) + "deg");
    });

    sheet.addEventListener("pointerleave", function () {
      sheet.dataset.tilting = "false";
      sheet.style.setProperty("--tilt-x", "0deg");
      sheet.style.setProperty("--tilt-y", "0deg");
      rect = null;
    });
  }

  /* ----------------------------------------------------------- magnetic */

  function initMagnetic() {
    var els = $$(".hero-actions .btn, .contact__mail");
    if (!els.length) return;

    els.forEach(function (el) {
      el.classList.add("mag");

      el.addEventListener("pointermove", function (event) {
        var rect = el.getBoundingClientRect();
        var dx = event.clientX - (rect.left + rect.width / 2);
        var dy = event.clientY - (rect.top + rect.height / 2);
        var x = Math.max(-5, Math.min(5, dx * 0.18));
        var y = Math.max(-5, Math.min(5, dy * 0.22));
        el.dataset.pull = "true";
        el.style.translate = x.toFixed(1) + "px " + y.toFixed(1) + "px";
      });

      el.addEventListener("pointerleave", function () {
        el.dataset.pull = "false";
        el.style.translate = "0px 0px";
      });
    });
  }

  /* ------------------------------------------------------- scroll chrome */

  function initScrollChrome() {
    var nav = $(".nav");

    var bar = document.createElement("div");
    bar.className = "scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    bar.appendChild(document.createElement("span"));
    document.body.appendChild(bar);

    var top = document.createElement("button");
    top.type = "button";
    top.className = "totop";
    top.dataset.show = "false";
    top.setAttribute("aria-label", "Back to top");
    top.setAttribute("title", "Back to top");
    top.innerHTML =
      '<svg class="totop__ring" viewBox="0 0 44 44" aria-hidden="true">' +
      '<circle cx="22" cy="22" r="20" pathLength="100"></circle></svg>' +
      '<svg class="totop__icon" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>';
    document.body.appendChild(top);

    var ring = $(".totop__ring circle", top);

    var links = $$(".nav__links .nav-link");
    var sections = links
      .map(function (a) {
        var id = (a.getAttribute("href") || "").replace(/^#/, "");
        return id ? document.getElementById(id) : null;
      })
      .filter(Boolean);

    var ticking = false;
    var sweptBottom = false;

    var update = function () {
      ticking = false;

      var y = window.scrollY || window.pageYOffset || 0;
      var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var p = Math.min(1, Math.max(0, y / max));

      bar.style.setProperty("--p", p.toFixed(4));
      ring.style.setProperty("--ring", (100 - p * 100).toFixed(2));

      if (nav) nav.dataset.scrolled = String(y > 4);
      top.dataset.show = String(y > 600);

      /* Anything still waiting at the very end of the page is shown, so no
         element can be stranded off-screen by observer rounding. */
      if (p >= 1) {
        if (!sweptBottom) {
          sweptBottom = true;
          $$("[data-reveal]:not(.is-in), [data-reveal-group]:not(.is-in)").forEach(function (el) {
            el.classList.add("is-in");
          });
        }
      } else {
        sweptBottom = false;
      }

      if (!sections.length) return;

      var probe = y + (nav ? nav.offsetHeight : 56) + 96;
      var current = null;

      sections.forEach(function (section) {
        if (section.getBoundingClientRect().top + y <= probe) current = section.id;
      });

      /* At the very end of the document the last section is the answer, even
         when its top edge never reaches the probe line. */
      if (p >= 1) current = sections[sections.length - 1].id;

      links.forEach(function (a) {
        if (current && a.getAttribute("href") === "#" + current) {
          a.setAttribute("aria-current", "page");
        } else {
          a.removeAttribute("aria-current");
        }
      });
    };

    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      raf(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    top.addEventListener("click", function () {
      var smooth = !reduceQ.matches && root.dataset.motion !== "off";
      window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });

      var main = document.getElementById("main");
      if (main) {
        main.setAttribute("tabindex", "-1");
        main.focus({ preventScroll: true });
      }
    });

    update();
  }

  /* ---------------------------------------------------------------- init */

  function init() {
    var reduced = reduceQ.matches;
    if (reduced) root.dataset.motion = "off";

    var motionOff = root.dataset.motion === "off";

    initScrollChrome();

    if (motionOff) return;

    initWords();
    initReveal();
    if (fineQ.matches) {
      initSpotlight();
      initTilt();
      initMagnetic();
    }
    initCountUp();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

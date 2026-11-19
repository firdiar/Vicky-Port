/* Portfolio behaviour — theme, drawer, dot grid, copy to clipboard.
   Plain ES2019, no build step, no dependencies. Everything degrades to
   readable HTML if this file fails to load. */

(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------------------------------------------------------------- theme */

  function initTheme() {
    const root = document.documentElement;
    const set = (theme) => {
      root.dataset.theme = theme;
      try {
        localStorage.setItem("genesis-theme", theme);
      } catch (e) {}
      $$("[data-theme-toggle]").forEach((btn) => {
        btn.setAttribute(
          "aria-label",
          theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
        );
        btn.setAttribute("title", theme === "dark" ? "Light theme" : "Dark theme");
      });
    };

    if (!root.dataset.theme) {
      let stored = null;
      try {
        stored = localStorage.getItem("genesis-theme");
      } catch (e) {}
      set(
        stored ||
          (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      );
    } else {
      set(root.dataset.theme);
    }

    $$("[data-theme-toggle]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const next = root.dataset.theme === "dark" ? "light" : "dark";

        /* Circular wipe out of the button, where the browser can run a view
           transition. Silently falls back to an instant swap. */
        if (
          typeof document.startViewTransition === "function" &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
          root.dataset.motion !== "off"
        ) {
          const rect = btn.getBoundingClientRect();
          const x = Math.round(rect.left + rect.width / 2);
          const y = Math.round(rect.top + rect.height / 2);
          const radius = Math.ceil(
            Math.hypot(
              Math.max(x, window.innerWidth - x),
              Math.max(y, window.innerHeight - y)
            )
          );

          root.classList.add("theme-wipe");
          const view = document.startViewTransition(() => set(next));

          view.ready
            .then(() => {
              document.documentElement.animate(
                {
                  clipPath: [
                    "circle(0px at " + x + "px " + y + "px)",
                    "circle(" + radius + "px at " + x + "px " + y + "px)",
                  ],
                },
                {
                  duration: 520,
                  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
                  pseudoElement: "::view-transition-new(root)",
                }
              );
            })
            .catch(() => {});

          view.finished.then(
            () => root.classList.remove("theme-wipe"),
            () => root.classList.remove("theme-wipe")
          );
          return;
        }

        set(next);
      })
    );
  }

  /* --------------------------------------------------------------- drawer */

  function initDrawer() {
    const burger = $("[data-drawer-toggle]");
    const drawer = $("#drawer");
    if (!burger || !drawer) return;

    const setOpen = (open) => {
      burger.setAttribute("aria-expanded", String(open));
      drawer.dataset.open = String(open);
    };

    burger.addEventListener("click", () =>
      setOpen(burger.getAttribute("aria-expanded") !== "true")
    );

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer.dataset.open === "true") {
        setOpen(false);
        burger.focus();
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) setOpen(false);
    });
  }

  /* ------------------------------------------------------------- dot grid */

  function initDotGrid() {
    const hero = $(".hero");
    const grid = $(".dotgrid");
    if (!hero || !grid) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none)").matches) return;

    let raf = 0;
    let px = 0;
    let py = 0;

    hero.addEventListener("pointermove", (e) => {
      const rect = hero.getBoundingClientRect();
      px = e.clientX - rect.left;
      py = e.clientY - rect.top;
      hero.dataset.pointer = "true";
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          grid.style.setProperty("--mx", px + "px");
          grid.style.setProperty("--my", py + "px");
        });
      }
    });

    hero.addEventListener("pointerleave", () => {
      hero.dataset.pointer = "false";
    });
  }

  /* ---------------------------------------------------------------- toast */

  let toastTimer = 0;

  function toast(message) {
    let el = $("#toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.dataset.open = "true";
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      el.dataset.open = "false";
    }, 2200);
  }

  /* --------------------------------------------------------- copy to board */

  async function copyText(text, okMessage) {
    /* execCommand still works when the async clipboard API refuses (no focus,
       no permission, older browser). Try it before giving up. */
    const legacyCopy = () => {
      try {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.top = "-1000px";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        area.setSelectionRange(0, text.length);
        const ok = document.execCommand("copy");
        area.remove();
        return ok;
      } catch (e) {
        return false;
      }
    };

    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      } else {
        ok = legacyCopy();
      }
    } catch (e) {
      ok = legacyCopy();
    }

    if (ok) {
      if (okMessage) toast(okMessage);
    } else {
      toast("Copy failed — select the text manually");
    }
    return ok;
  }

  function initCopy() {
    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-copy-value]");
      if (!el) return;
      const value = el.getAttribute("data-copy-value");
      copyText(value, "Copied " + value).then((ok) => {
        if (!ok) return;
        el.dataset.copied = "true";
        window.setTimeout(() => delete el.dataset.copied, 1400);
      });
    });
  }

  /* ---------------------------------------------------------------- init */

  function init() {
    initTheme();
    initDrawer();
    initDotGrid();
    initCopy();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

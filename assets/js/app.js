/* Genesis — static site behaviour.
   Plain ES2019, no build step, no dependencies. Everything degrades to
   readable HTML if this file fails to load. */

(function () {
  "use strict";

  const KITS = (window.GENESIS && window.GENESIS.kits) || [];
  const PAGES = (window.GENESIS && window.GENESIS.pages) || [];

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const esc = (value) =>
    String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));

  const fmt = (n) => {
    if (n >= 1000) {
      const v = n / 1000;
      return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + "k";
    }
    return String(n);
  };

  /** "2 weeks ago" -> 14 */
  const ageDays = (label) => {
    const m = /(\d+)\s+(day|week|month|year)s?\s+ago/.exec(label || "");
    if (!m) return 9999;
    const mult = { day: 1, week: 7, month: 30, year: 365 }[m[2]];
    return Number(m[1]) * mult;
  };

  const ICON = {
    download:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/></svg>',
    copy:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    heart:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.8C19 15.6 12 20 12 20Z"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>',
    search:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>',
  };

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

  /* ---------------------------------------------------------------- menu */

  function initMenu() {
    const toggles = $$("[data-menu-toggle]");
    if (!toggles.length) return;

    const closeAll = () => {
      toggles.forEach((toggle) => {
        toggle.setAttribute("aria-expanded", "false");
        const menu = toggle.parentElement.querySelector("[data-menu]");
        if (menu) menu.dataset.open = "false";
      });
    };

    toggles.forEach((toggle) => {
      const menu = toggle.parentElement.querySelector("[data-menu]");
      if (!menu) return;

      menu.dataset.open = "false";
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = menu.dataset.open !== "true";
        closeAll();
        menu.dataset.open = String(open);
        toggle.setAttribute("aria-expanded", String(open));
      });

      menu.addEventListener("click", (e) => e.stopPropagation());
    });

    document.addEventListener("click", closeAll);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll();
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

    $$("[data-copy-target]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const target = $(btn.getAttribute("data-copy-target"));
        if (target) copyText(target.textContent.trim(), "Copied to clipboard");
      })
    );
  }

  /* ------------------------------------------------------------- palette */

  const TOKENS = [
    "Primary|#6366F1|CTAs, active states, links, focus rings",
    "Primary Hover|#4F46E5|Hover state for primary elements",
    "Secondary|#20970B|Brand highlight, homepage only",
    "Neutral|#9C9C9C|Muted text, placeholders, disabled",
    "Background|#FAFAFA|Page background",
    "Surface|#FFFFFF|Cards, panels, nav backdrop",
    "Text Primary|#0A0A0A|Headings and body text",
    "Text Secondary|#6B6B6B|Descriptions and metadata",
    "Border|#E8E8EC|Card borders and dividers",
    "Success|#10B981|Published and confirmations",
    "Warning|#F59E0B|Pending and caution",
    "Error|#EF4444|Destructive and validation errors",
  ].map((row) => {
    const [name, hex, sub] = row.split("|");
    return { title: name, href: null, sub, kind: "token", hex };
  });

  function paletteEntries() {
    return [
      ...KITS.map((k) => ({
        title: k.name,
        sub: "@" + k.owner.handle + " · " + k.tags.join(", "),
        href: "kit.html?id=" + encodeURIComponent(k.id),
        kind: "kit",
        search: (
          k.name +
          " " +
          k.owner.handle +
          " " +
          k.tags.join(" ") +
          " " +
          k.tagline
        ).toLowerCase(),
      })),
      ...PAGES.map((p) => ({
        title: p.title,
        sub: p.sub,
        href: p.href,
        kind: "page",
        search: (p.title + " " + p.sub + " " + (p.keywords || "")).toLowerCase(),
      })),
      ...TOKENS.map((t) => ({
        title: t.title,
        sub: t.hex + " · " + t.sub,
        href: null,
        hex: t.hex,
        kind: "token",
        search: (t.title + " " + t.hex + " " + t.sub).toLowerCase(),
      })),
    ];
  }

  function initPalette() {
    const triggers = $$("[data-search-trigger]");
    if (!triggers.length) return;

    const entries = paletteEntries();
    const dialog = document.createElement("dialog");
    dialog.className = "palette";
    dialog.setAttribute("aria-label", "Search kits, pages and tokens");
    dialog.innerHTML =
      '<div class="palette__panel">' +
      '<div class="palette__search">' +
      ICON.search +
      '<input class="palette__input" type="search" placeholder="Search kits, pages, tokens…" aria-label="Search" autocomplete="off" spellcheck="false">' +
      '<span class="kbd">ESC</span>' +
      "</div>" +
      '<div class="palette__results" role="listbox" aria-label="Results"></div>' +
      '<div class="palette__foot"><span><span class="kbd">↑</span> <span class="kbd">↓</span> to move</span><span><span class="kbd">↵</span> to open</span><span class="palette__count"></span></div>' +
      "</div>";
    document.body.appendChild(dialog);

    const input = $(".palette__input", dialog);
    const results = $(".palette__results", dialog);
    const count = $(".palette__count", dialog);
    let active = 0;
    let shown = [];

    const render = (query) => {
      const q = query.trim().toLowerCase();
      shown = q
        ? entries.filter((e) => e.search.indexOf(q) !== -1 || e.title.toLowerCase().indexOf(q) !== -1)
        : entries;
      shown = shown.slice(0, 40);

      if (!shown.length) {
        results.innerHTML =
          '<p class="palette__empty">No match for “' + esc(query) + '”. Try a tag, an author handle or a hex value.</p>';
        count.textContent = "";
        return;
      }

      let html = "";
      let lastKind = null;
      shown.forEach((entry, i) => {
        if (entry.kind !== lastKind) {
          const label =
            entry.kind === "kit" ? "Kits" : entry.kind === "page" ? "Pages" : "Design tokens";
          html += '<div class="palette__group-label">' + label + "</div>";
          lastKind = entry.kind;
        }
        html +=
          '<button type="button" class="palette__item" role="option" data-index="' + i + '" data-active="' + (i === 0) + '">' +
          '<span class="palette__item-main"><span>' + esc(entry.title) + "</span>" +
          '<span class="palette__item-sub">' + esc(entry.sub) + "</span></span>" +
          '<span class="palette__item-kind">' + esc(entry.kind) + "</span>" +
          "</button>";
      });
      results.innerHTML = html;
      count.textContent = shown.length + (shown.length === 1 ? " result" : " results");
      active = 0;
    };

    const setActive = (next) => {
      if (!shown.length) return;
      active = (next + shown.length) % shown.length;
      $$(".palette__item", results).forEach((el) => {
        el.dataset.active = String(Number(el.dataset.index) === active);
      });
      const current = $('.palette__item[data-index="' + active + '"]', results);
      if (current) current.scrollIntoView({ block: "nearest" });
    };

    const choose = (entry) => {
      if (!entry) return;
      dialog.close();
      if (entry.href) {
        window.location.href = entry.href;
      } else if (entry.hex) {
        copyText(entry.hex, "Copied " + entry.hex);
      }
    };

    const open = () => {
      render("");
      dialog.showModal();
      input.value = "";
      input.focus();
    };

    triggers.forEach((t) =>
      t.addEventListener("click", (e) => {
        e.preventDefault();
        open();
      })
    );

    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        dialog.open ? dialog.close() : open();
      }
    });

    input.addEventListener("input", () => render(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(active + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(active - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        choose(shown[active]);
      }
    });

    results.addEventListener("mousemove", (e) => {
      const item = e.target.closest(".palette__item");
      if (item) setActive(Number(item.dataset.index));
    });

    results.addEventListener("click", (e) => {
      const item = e.target.closest(".palette__item");
      if (item) choose(shown[Number(item.dataset.index)]);
    });

    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });

    dialog.addEventListener("close", () => {
      if (triggers[0]) triggers[0].focus();
    });
  }

  /* -------------------------------------------------------------- cards */

  function kitCard(kit) {
    return (
      '<a class="card card--hover kit-card" href="kit.html?id=' + encodeURIComponent(kit.id) + '">' +
      '<div class="kit-card__media">' +
      '<img src="assets/img/kits/' + esc(kit.id) + '.svg" alt="' + esc(kit.name) + " kit sheet preview" + '" width="800" height="400" loading="lazy" decoding="async">' +
      "</div>" +
      '<div class="kit-card__body">' +
      '<div class="kit-card__top"><div>' +
      '<h3 class="kit-card__title">' + esc(kit.name) + "</h3>" +
      '<p class="kit-card__author">@' + esc(kit.owner.handle) + "</p>" +
      "</div>" +
      '<span class="badge">' + esc(kit.version) + "</span>" +
      "</div>" +
      '<p class="kit-card__desc">' + esc(kit.tagline) + "</p>" +
      '<div class="chip-row">' +
      kit.tags
        .slice(0, 3)
        .map((t) => '<span class="chip">' + esc(t) + "</span>")
        .join("") +
      "</div>" +
      '<div class="kit-card__foot">' +
      '<span class="stat">' + ICON.download + '<span class="stat__num">' + fmt(kit.downloads) + "</span> downloads</span>" +
      '<span class="stat">' + ICON.heart + '<span class="stat__num">' + fmt(kit.likes) + "</span></span>" +
      "</div>" +
      "</div></a>"
    );
  }

  function kitRow(kit) {
    return (
      '<a class="kit-list__row" href="kit.html?id=' + encodeURIComponent(kit.id) + '">' +
      '<span class="kit-list__thumb"><img src="assets/img/kits/' + esc(kit.id) + '.svg" alt="" width="800" height="400" loading="lazy"></span>' +
      '<span><span class="kit-list__title">' + esc(kit.name) + "</span>" +
      '<span class="kit-list__sub">@' + esc(kit.owner.handle) + " · " + esc(kit.license) + " · " + esc(kit.uploaded) + "</span></span>" +
      '<span class="kit-list__tags">' +
      kit.tags.slice(0, 2).map((t) => '<span class="chip">' + esc(t) + "</span>").join("") +
      "</span>" +
      '<span class="kit-list__stats stat">' + ICON.download + '<span class="stat__num">' + fmt(kit.downloads) + "</span> downloads</span>" +
      "</a>"
    );
  }

  /* -------------------------------------------------------------- explore */

  function initExplore() {
    const grid = $("#results");
    if (!grid) return;

    const search = $("#filter-search");
    const sort = $("#filter-sort");
    const count = $("#result-count");
    const empty = $("#empty-state");
    const chipWrap = $("#filter-tags");
    const viewBtns = $$("[data-view]");

    const params = new URLSearchParams(window.location.search);
    const state = {
      q: params.get("q") || "",
      tag: params.get("tag") || "all",
      sort: params.get("sort") || "downloads",
      view: params.get("view") || "grid",
    };

    const tags = (() => {
      const counts = new Map();
      KITS.forEach((k) =>
        k.tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1))
      );
      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([t]) => t)
        .slice(0, 12);
    })();

    chipWrap.innerHTML =
      '<button type="button" class="chip" data-tag="all" aria-pressed="' +
      (state.tag === "all") +
      '">All kits</button>' +
      tags
        .map(
          (t) =>
            '<button type="button" class="chip" data-tag="' + esc(t) + '" aria-pressed="' +
            (state.tag === t) +
            '">' + esc(t) + "</button>"
        )
        .join("");

    if (search) search.value = state.q;
    if (sort) sort.value = state.sort;
    if (search) {
      const wrap = search.closest(".input-icon");
      if (wrap) wrap.dataset.filled = String(Boolean(state.q));
    }

    const syncUrl = () => {
      const next = new URLSearchParams();
      if (state.q) next.set("q", state.q);
      if (state.tag !== "all") next.set("tag", state.tag);
      if (state.sort !== "downloads") next.set("sort", state.sort);
      if (state.view !== "grid") next.set("view", state.view);
      const qs = next.toString();
      history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
    };

    const apply = () => {
      const q = state.q.trim().toLowerCase();
      let rows = KITS.filter((k) => {
        const matchesTag = state.tag === "all" || k.tags.indexOf(state.tag) !== -1;
        const haystack = (
          k.name + " " + k.owner.handle + " " + k.tags.join(" ") + " " + k.tagline
        ).toLowerCase();
        return matchesTag && (!q || haystack.indexOf(q) !== -1);
      });

      if (state.sort === "recent") rows.sort((a, b) => ageDays(a.uploaded) - ageDays(b.uploaded));
      else if (state.sort === "name") rows.sort((a, b) => a.name.localeCompare(b.name));
      else if (state.sort === "likes") rows.sort((a, b) => b.likes - a.likes);
      else rows.sort((a, b) => b.downloads - a.downloads);

      grid.className = state.view === "list" ? "kit-list" : "kit-grid";
      grid.innerHTML =
        state.view === "list"
          ? rows.map(kitRow).join("")
          : rows.map((k) => kitCard(k)).join("");

      if (empty) empty.hidden = rows.length > 0;
      if (count) {
        count.textContent =
          rows.length === 0
            ? "No kits match these filters"
            : "Showing " + rows.length + " of " + KITS.length + " kits";
      }

      viewBtns.forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.view === state.view))
      );
      $$("[data-tag]", chipWrap).forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.tag === state.tag))
      );
      syncUrl();
    };

    if (search) {
      search.addEventListener("input", () => {
        state.q = search.value;
        const wrap = search.closest(".input-icon");
        if (wrap) wrap.dataset.filled = String(Boolean(search.value));
        apply();
      });
    }

    chipWrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tag]");
      if (!btn) return;
      state.tag = btn.dataset.tag;
      apply();
    });

    if (sort) {
      sort.addEventListener("change", () => {
        state.sort = sort.value;
        apply();
      });
    }

    viewBtns.forEach((btn) =>
      btn.addEventListener("click", () => {
        state.view = btn.dataset.view;
        apply();
      })
    );

    const clear = $("#filter-clear");
    if (clear) {
      clear.addEventListener("click", () => {
        state.q = "";
        state.tag = "all";
        state.sort = "downloads";
        if (search) search.value = "";
        if (sort) sort.value = "downloads";
        const wrap = search && search.closest(".input-icon");
        if (wrap) wrap.dataset.filled = "false";
        apply();
      });
    }

    const reset = $("#empty-reset");
    if (reset) {
      reset.addEventListener("click", () => {
        state.q = "";
        state.tag = "all";
        if (search) search.value = "";
        const wrap = search && search.closest(".input-icon");
        if (wrap) wrap.dataset.filled = "false";
        apply();
      });
    }

    apply();
  }

  /* ------------------------------------------------------------ kit page */

  function markdownFor(kit) {
    const lines = [];
    lines.push("# " + kit.name, "");
    lines.push("> " + kit.tagline, "");
    lines.push("## Overview", "", kit.description, "");
    lines.push("## Colors", "");
    kit.colors.forEach((c) => lines.push("- **" + c.name + "** (" + c.hex + ")"));
    lines.push("");
    lines.push("## Typography", "");
    lines.push("- **Display**: " + kit.fonts.display);
    lines.push("- **Body**: " + kit.fonts.body);
    lines.push("- **Code**: " + kit.fonts.mono, "");
    lines.push("## Metadata", "");
    lines.push("- Version: " + kit.version);
    lines.push("- License: " + kit.license);
    lines.push("- Author: @" + kit.owner.handle);
    lines.push("- Published: " + kit.uploaded);
    lines.push("- Tags: " + kit.tags.join(", "));
    lines.push("");
    return lines.join("\n");
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function initKit() {
    const host = $("#kit-root");
    if (!host) return;

    const id = new URLSearchParams(window.location.search).get("id");
    const kit = KITS.find((k) => k.id === id) || KITS[0];

    document.title = kit.name + " — kitmd";
    const titles = $$("[data-kit-title]");
    titles.forEach((el) => (el.textContent = kit.name));

    const statusChip =
      kit.status === "published"
        ? '<span class="chip chip--status-published"><span class="status-dot"></span>Published</span>'
        : kit.status === "pending"
        ? '<span class="chip chip--status-pending"><span class="status-dot"></span>In review</span>'
        : '<span class="chip chip--status-rejected"><span class="status-dot"></span>Rejected</span>';

    host.innerHTML =
      '<div class="crumbs"><a href="registry.html">Home</a>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>' +
      '<a href="explore.html">Explore</a>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>' +
      "<span>" + esc(kit.name) + "</span></div>" +

      '<div class="kit-head">' +
      "<div>" +
      '<h1 class="kit-head__title">' + esc(kit.name) + "</h1>" +
      '<div class="kit-head__meta">' +
      '<span class="row" style="gap:8px"><span class="avatar avatar--sm avatar--tone-' + kit.owner.tone + '">' + esc(kit.owner.initials) + "</span>@" + esc(kit.owner.handle) + "</span>" +
      '<span class="badge">' + esc(kit.version) + "</span>" +
      statusChip +
      "<span>Updated " + esc(kit.uploaded) + "</span>" +
      "</div></div>" +
      '<span class="chip-row">' + kit.tags.map((t) => '<span class="chip">' + esc(t) + "</span>").join("") + "</span>" +
      "</div>" +

      '<div class="kit-layout">' +
      "<div>" +
      '<div class="kit-preview"><img src="assets/img/kits/' + esc(kit.id) + '.svg" alt="' + esc(kit.name) + ' kit sheet" width="800" height="400"></div>' +

      '<div class="prose" style="margin-top:var(--s8)">' +
      "<h2>Overview</h2><p>" + esc(kit.description) + "</p>" +
      "<h2>Color palette</h2>" +
      '<div class="swatches" style="margin-top:var(--s4)">' +
      kit.colors
        .map(
          (c) =>
            '<button type="button" class="swatch" data-copy-value="' + esc(c.hex) + '" aria-label="Copy ' + esc(c.name) + " " + esc(c.hex) + '">' +
            '<span class="swatch__chip" style="background:' + esc(c.hex) + '"></span>' +
            '<span class="swatch__meta"><span class="swatch__name">' + esc(c.name) + "</span>" +
            '<span class="swatch__hex">' + esc(c.hex) + "</span></span></button>"
        )
        .join("") +
      "</div>" +
      "<h2>Typography</h2>" +
      '<div class="list" style="margin-top:var(--s4)">' +
      '<div class="list__row"><span>Display</span><span class="list__meta">' + esc(kit.fonts.display) + "</span></div>" +
      '<div class="list__row"><span>Body</span><span class="list__meta">' + esc(kit.fonts.body) + "</span></div>" +
      '<div class="list__row"><span>Code</span><span class="list__meta">' + esc(kit.fonts.mono) + "</span></div>" +
      "</div>" +
      "<h2>Notes</h2>" +
      "<ul><li>Tags: " + kit.tags.map(esc).join(", ") + "</li>" +
      "<li>License: " + esc(kit.license) + "</li>" +
      "<li>Documented with the DESIGN.md format, " + esc(kit.size) + "</li></ul>" +
      "</div></div>" +

      '<aside class="kit-aside">' +
      '<div class="card">' +
      '<button type="button" class="btn btn--primary btn--block" id="kit-download">' + ICON.download + "Download .md</button>" +
      '<button type="button" class="btn btn--secondary btn--block mt-2" id="kit-copy">' + ICON.copy + "Copy to clipboard</button>" +
      '<button type="button" class="btn btn--ghost btn--block mt-2" id="kit-like">' + ICON.heart + 'Like <span id="kit-likes">(' + fmt(kit.likes) + ")</span></button>" +
      '<dl class="meta-list mt-5">' +
      '<div class="meta-row"><dt>Author</dt><dd><a href="explore.html">@' + esc(kit.owner.handle) + "</a></dd></div>" +
      '<div class="meta-row"><dt>Version</dt><dd class="mono">' + esc(kit.version) + "</dd></div>" +
      '<div class="meta-row"><dt>License</dt><dd>' + esc(kit.license) + "</dd></div>" +
      '<div class="meta-row"><dt>File size</dt><dd class="mono">' + esc(kit.size) + "</dd></div>" +
      '<div class="meta-row"><dt>Uploaded</dt><dd>' + esc(kit.uploaded) + "</dd></div>" +
      '<div class="meta-row"><dt>Downloads</dt><dd class="mono">' + kit.downloads.toLocaleString("en-US") + "</dd></div>" +
      '<div class="meta-row"><dt>Copies</dt><dd class="mono">' + kit.copies.toLocaleString("en-US") + "</dd></div>" +
      "</dl></div>" +

      '<div class="card"><p class="eyebrow">Palette</p><div class="mt-3">' +
      kit.colors
        .map(
          (c) =>
            '<div class="swatch-mini"><span class="swatch-mini__chip" style="background:' + esc(c.hex) + '"></span>' +
            "<span>" + esc(c.name) + '</span><span class="swatch-mini__hex">' + esc(c.hex) + "</span></div>"
        )
        .join("") +
      "</div></div>" +
      "</aside></div>";

    $("#kit-download").addEventListener("click", () => {
      downloadText(kit.id + ".design.md", markdownFor(kit));
      toast("Downloading " + kit.id + ".design.md");
    });

    $("#kit-copy").addEventListener("click", () =>
      copyText(markdownFor(kit), "Kit copied as markdown")
    );

    let liked = false;
    $("#kit-like").addEventListener("click", (e) => {
      liked = !liked;
      e.currentTarget.setAttribute("aria-pressed", String(liked));
      $("#kit-likes").textContent = "(" + fmt(kit.likes + (liked ? 1 : 0)) + ")";
      e.currentTarget.classList.toggle("btn--secondary", liked);
      e.currentTarget.classList.toggle("btn--ghost", !liked);
      toast(liked ? "Liked " + kit.name : "Like removed");
    });

    const more = $("#more-kits");
    if (more) {
      const related = KITS.filter(
        (k) => k.id !== kit.id && k.tags.some((t) => kit.tags.indexOf(t) !== -1)
      )
        .concat(KITS.filter((k) => k.id !== kit.id))
        .slice(0, 3);
      more.innerHTML = related.map((k, i) => kitCard(k)).join("");
    }
  }

  /* ----------------------------------------------------------------- toc */

  function initToc() {
    const links = $$(".toc__link");
    if (!links.length || !("IntersectionObserver" in window)) return;
    const sections = links
      .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
      .filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((a) =>
            a.setAttribute(
              "data-active",
              String(a.getAttribute("href") === "#" + entry.target.id)
            )
          );
        });
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    sections.forEach((s) => observer.observe(s));
  }

  /* ---------------------------------------------------------------- init */

  function init() {
    initTheme();
    initDrawer();
    initMenu();
    initDotGrid();
    initCopy();
    initPalette();
    initExplore();
    initKit();
    initToc();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

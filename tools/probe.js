/* Headless interaction probe.
   Drives Chrome over the DevTools Protocol (WebSocket is built into Node 22+)
   to prove that the motion layer actually does something: content is hidden
   before it scrolls in, revealed after, the scroll chrome reports progress,
   hover lights a card, the theme toggle flips, and reduced motion disarms the
   whole thing. Also writes screenshots of each state.

   usage: node tools/probe.js [--url=http://127.0.0.1:8080/index.html]
                              [--out=%TEMP%\gm] [--width=1440] [--height=1000]

   Exits 0 when every check passes, 1 otherwise. No npm dependencies. */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const args = {};
process.argv.slice(2).forEach((arg) => {
  const m = /^--([^=]+)=(.*)$/.exec(arg);
  if (m) args[m[1]] = m[2];
});

const URL_UNDER_TEST = args.url || "http://127.0.0.1:8080/index.html";
const SWEEP = args.sweep === "1" || args.sweep === "true";
const OUT_DIR = args.out || path.join(os.tmpdir(), "gm");
const WIDTH = Number(args.width || 1440);
const HEIGHT = Number(args.height || 1000);
const PORT = Number(args.port || 9333);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass: Boolean(pass), detail: detail === undefined ? "" : String(detail) });
  const mark = pass ? "ok  " : "FAIL";
  console.log(`[${mark}] ${name}${detail === undefined ? "" : " — " + detail}`);
}

function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function waitForDevtools(deadlineMs) {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return await res.json();
    } catch (e) {
      /* not up yet */
    }
    await sleep(120);
  }
  throw new Error("DevTools endpoint never came up on port " + PORT);
}

async function openTarget(url) {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  if (!res.ok) throw new Error("could not open a tab: HTTP " + res.status);
  return res.json();
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    const listeners = new Map();
    let nextId = 0;

    const api = {
      send(method, params) {
        return new Promise((res, rej) => {
          const id = ++nextId;
          pending.set(id, { res, rej });
          ws.send(JSON.stringify({ id, method, params: params || {} }));
        });
      },
      on(method, fn) {
        if (!listeners.has(method)) listeners.set(method, []);
        listeners.get(method).push(fn);
      },
      once(method) {
        return new Promise((res) => {
          const fn = (params) => {
            const list = listeners.get(method) || [];
            const i = list.indexOf(fn);
            if (i !== -1) list.splice(i, 1);
            res(params);
          };
          api.on(method, fn);
        });
      },
      close() {
        try {
          ws.close();
        } catch (e) {}
      },
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const entry = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) entry.rej(new Error(msg.method + ": " + msg.error.message));
        else entry.res(msg.result);
        return;
      }
      if (msg.method) {
        (listeners.get(msg.method) || []).forEach((fn) => fn(msg.params));
        (listeners.get("*") || []).forEach((fn) => fn(msg));
      }
    };

    ws.onerror = () => reject(new Error("websocket error"));
    ws.onopen = () => resolve(api);
  });
}

async function main() {
  const chrome = findChrome();
  if (!chrome) throw new Error("Chrome/Edge not found — set CHROME_PATH");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "gm-profile-"));

  const child = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--force-device-scale-factor=1",
      `--window-size=${WIDTH},${HEIGHT}`,
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let api = null;

  try {
    await waitForDevtools(20000);

    const target = await openTarget("about:blank");
    api = await connect(target.webSocketDebuggerUrl);

    /* Deterministic clipboard: grant the permission at browser level and let
       the page believe it has focus, which headless otherwise withholds. */
    try {
      const version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      const browserApi = await connect(version.webSocketDebuggerUrl);
      await browserApi
        .send("Browser.grantPermissions", {
          origin: new URL(URL_UNDER_TEST).origin,
          permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
        })
        .catch(() => {});
      browserApi.close();
    } catch (e) {}

    const errors = [];
    api.on("Runtime.exceptionThrown", (p) => {
      const d = p.exceptionDetails || {};
      errors.push((d.exception && d.exception.description) || d.text || "exception");
    });
    api.on("Runtime.consoleAPICalled", (p) => {
      if (p.type === "error") {
        errors.push((p.args || []).map((a) => a.value || a.description || "").join(" "));
      }
    });
    api.on("Log.entryAdded", (p) => {
      if (p.entry && p.entry.level === "error") errors.push(p.entry.text);
    });

    await api.send("Page.enable");
    await api.send("Runtime.enable");
    await api.send("Log.enable");
    await api.send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
    await api.send("Emulation.setDeviceMetricsOverride", {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const evaluate = async (expression) => {
      const res = await api.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
        userGesture: true,
      });
      if (res.exceptionDetails) {
        const d = res.exceptionDetails;
        throw new Error((d.exception && d.exception.description) || d.text || "evaluate failed");
      }
      return res.result.value;
    };

    const shot = async (name) => {
      const res = await api.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(OUT_DIR, name + ".png"), Buffer.from(res.data, "base64"));
    };

    const load = async (url) => {
      const loaded = api.once("Page.loadEventFired");
      await api.send("Page.navigate", { url });
      await loaded;
      await sleep(250);
    };

    const scrollTo = async (y) => {
      await evaluate(`window.scrollTo({ top: ${y}, behavior: "instant" }); true`);
      await sleep(60);
    };

    /* --sweep: walk the whole page and prove nothing stays hidden, which is
       the only failure mode the reveal layer can have on a page it does not
       know. Used across all four pages. */
    const runSweep = async () => {
      const height = await evaluate(`document.documentElement.scrollHeight`);
      for (let y = 0; y < height; y += 480) {
        await scrollTo(y);
        await sleep(300);
      }
      await scrollTo(height);
      await sleep(1400);

      const report = await evaluate(`(() => {
        const pending = document.querySelectorAll("[data-reveal]:not(.is-in), [data-reveal-group]:not(.is-in)");
        const faded = [];
        document.querySelectorAll("[data-reveal], [data-reveal-group] > *").forEach((el) => {
          if (Number(getComputedStyle(el).opacity) < 0.99) faded.push(el.className || el.tagName);
        });
        const bar = document.querySelector(".scroll-progress");
        const top = document.querySelector(".totop");
        return {
          targets: document.querySelectorAll("[data-reveal], [data-reveal-group]").length,
          pending: Array.from(pending).slice(0, 5).map((el) => el.className || el.tagName),
          pendingCount: pending.length,
          fadedCount: faded.length,
          faded: faded.slice(0, 5),
          progress: bar ? Number(bar.style.getPropertyValue("--p")) : -1,
          totop: top ? top.dataset.show : "missing",
          theme: document.documentElement.dataset.theme,
        };
      })()`);

      const page = URL_UNDER_TEST.replace(/^https?:\/\/[^/]+\//, "");
      check(`${page}: reveals tagged`, report.targets > 0, `${report.targets} targets`);
      check(`${page}: all revealed after a full scroll`, report.pendingCount === 0, report.pending.join(", "));
      check(`${page}: nothing left transparent`, report.fadedCount === 0, report.faded.join(", "));
      check(`${page}: scroll chrome works`, report.progress > 0.98 && report.totop === "true",
        `progress=${report.progress.toFixed(3)} totop=${report.totop}`);

      const anchorNav = await evaluate(`(() => {
        const links = Array.from(document.querySelectorAll(".nav__links .nav-link"));
        const hash = links.filter((a) => (a.getAttribute("href") || "").charAt(0) === "#");
        if (!hash.length) return null;
        const active = document.querySelector(".nav__links .nav-link[aria-current]");
        return { last: hash[hash.length - 1].textContent.trim(),
                 active: active ? active.textContent.trim() : "(none)" };
      })()`);

      if (anchorNav) {
        check(`${page}: last section is current at the bottom`, anchorNav.active === anchorNav.last,
          `active=${anchorNav.active} expected=${anchorNav.last}`);
      }

      await shot("sweep-" + page.replace(/[^a-z0-9]+/gi, "-"));
    };
    /* ---------------------------------------------------------- 1. boot */
    await load(URL_UNDER_TEST);
    await sleep(1400); // let the hero entrance and count-up finish

    if (args.eval) {
      if (args.hover) {
        const box = await evaluate(`(() => {
          const el = document.querySelector(${JSON.stringify(args.hover)});
          if (!el) return null;
          el.scrollIntoView({ block: "center", behavior: "instant" });
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()`);
        if (box) {
          await sleep(700);
          await api.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y, button: "none" });
          await sleep(420);
        }
      }
      const value = await evaluate(args.eval);
      console.log(JSON.stringify(value, null, 2));
      if (args.shot) await shot(args.shot);
      return;
    }

    if (SWEEP) {
      await runSweep();
      check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    } else {

    check("motion.js booted", (await evaluate(`document.documentElement.dataset.motionReady`)) === "1");

    check(
      "head script marked the document as js",
      await evaluate(`document.documentElement.classList.contains("js")`)
    );

    check(
      "hero group revealed",
      await evaluate(`document.querySelector(".hero__copy").classList.contains("is-in")`)
    );

    const wordCount = await evaluate(`document.querySelectorAll(".hero__title .w").length`);
    check("hero title split into words", wordCount >= 6, `${wordCount} words`);

    check(
      "scroll chrome injected",
      await evaluate(`!!document.querySelector(".scroll-progress") && !!document.querySelector(".totop")`)
    );

    const stats = await evaluate(
      `Array.from(document.querySelectorAll(".hero-stat__value")).map((el) => el.textContent).join("|")`
    );
    check("count-up landed on the real figures", stats === "2020|3|5|50", stats);

    check(
      "no section is marked current at the top of the page",
      await evaluate(`!document.querySelector(".nav__links [aria-current]")`)
    );

    await shot("01-hero");

    /* --------------------------------------- 1b. hero pointer feedback */
    if (WIDTH > 900) {
      const sheetBox = await evaluate(`(() => {
        const r = document.querySelector(".hero__inner > .sheet").getBoundingClientRect();
        return { x: Math.round(r.left + r.width * 0.78), y: Math.round(r.top + r.height * 0.25) };
      })()`);

      await api.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: sheetBox.x, y: sheetBox.y, button: "none" });
      await sleep(300);

      const tilt = await evaluate(`(() => {
        const el = document.querySelector(".hero__inner > .sheet");
        return { x: el.style.getPropertyValue("--tilt-x"), y: el.style.getPropertyValue("--tilt-y"),
                 transform: getComputedStyle(el).transform };
      })()`);

      check(
        "hero sheet tilts toward the pointer",
        tilt.x !== "" && tilt.y !== "" && tilt.transform.startsWith("matrix3d"),
        `tilt-x=${tilt.x} tilt-y=${tilt.y}`
      );

      const magnet = await evaluate(`(() => {
        const el = document.querySelector(".hero-actions .btn--primary");
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.right - 6), y: Math.round(r.top + r.height / 2), w: r.width };
      })()`);

      await api.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: magnet.x, y: magnet.y, button: "none" });
      await sleep(260);

      const pulled = await evaluate(`(() => {
        const el = document.querySelector(".hero-actions .btn--primary");
        return { translate: el.style.translate, pull: el.dataset.pull };
      })()`);

      check(
        "primary button is magnetic",
        pulled.pull === "true" && pulled.translate !== "" && pulled.translate !== "0px 0px",
        `translate=${pulled.translate}`
      );

      /* move away again so the tilt resets before the next screenshot */
      await api.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 4, y: 4, button: "none" });
      await sleep(320);

      const reset = await evaluate(`document.querySelector(".hero__inner > .sheet").style.getPropertyValue("--tilt-x")`);
      check("tilt resets when the pointer leaves", reset === "0deg", reset);
    }

    /* ------------------------------------- 1d. copyable credential row */
    const copied = await evaluate(`(() => {
      const el = document.querySelector(".sheet__row--copy");
      el.click();
      return el.getAttribute("data-copy-value");
    })()`);
    await sleep(400);
    const copyState = await evaluate(`(() => {
      const el = document.querySelector(".sheet__row--copy");
      const toast = document.getElementById("toast");
      return { copied: el.dataset.copied, toast: toast ? toast.textContent : "",
               shown: toast ? toast.dataset.open : "false" };
    })()`);

    check(
      "credential row copies its number",
      copyState.copied === "true" && /Copied/.test(copyState.toast),
      `value=${copied} toast=${copyState.toast}`
    );

    /* -------------------------------------------- 1c. mobile drawer */
    if (WIDTH < 900) {
      const opened = await evaluate(`(() => {
        document.querySelector("[data-drawer-toggle]").click();
        return true;
      })()`);
      await sleep(420);

      const drawer = await evaluate(`(() => {
        const el = document.getElementById("drawer");
        const cs = getComputedStyle(el);
        return { open: el.dataset.open, visibility: cs.visibility, opacity: cs.opacity,
                 translate: cs.translate, links: el.querySelectorAll(".drawer__link").length };
      })()`);

      check(
        "mobile drawer slides open",
        drawer.open === "true" && drawer.visibility === "visible" && drawer.opacity === "1",
        `opacity=${drawer.opacity} links=${drawer.links}`
      );

      await shot("01b-drawer");

      await evaluate(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); true`);
      await sleep(400);
      const closed = await evaluate(`document.getElementById("drawer").dataset.open`);
      check("Escape closes the drawer", closed === "false", closed);
    }

    /* -------------------------------------- 2. hidden before scrolling */
    const belowFold = await evaluate(`(() => {
      const items = Array.from(document.querySelectorAll(".timeline__item"));
      const el = items[items.length - 1];
      const cs = getComputedStyle(el);
      return { opacity: cs.opacity, translate: cs.translate, isIn: el.classList.contains("is-in") };
    })()`);
    check(
      "off-screen timeline item starts hidden",
      belowFold.opacity === "0" && !belowFold.isIn,
      `opacity=${belowFold.opacity} translate=${belowFold.translate}`
    );

    /* -------------------------------------------- 3. reveal on scroll */
    await evaluate(`document.getElementById("experience").scrollIntoView({ behavior: "instant", block: "start" })`);
    await sleep(1500);

    const afterScroll = await evaluate(`(() => {
      const items = Array.from(document.querySelectorAll(".timeline__item"));
      const el = items[0];
      const cs = getComputedStyle(el);
      const bar = document.querySelector(".scroll-progress");
      const top = document.querySelector(".totop");
      return {
        opacity: cs.opacity,
        isIn: el.classList.contains("is-in"),
        progress: parseFloat(bar.style.getPropertyValue("--p")),
        totop: top.dataset.show,
        current: (document.querySelector(".nav__links [aria-current]") || {}).textContent || "",
        scrolled: document.querySelector(".nav").dataset.scrolled,
      };
    })()`);

    check("timeline item revealed on scroll", afterScroll.isIn && afterScroll.opacity === "1");
    check("scroll progress tracks the page", afterScroll.progress > 0.1 && afterScroll.progress < 1, afterScroll.progress);
    check("back-to-top appears", afterScroll.totop === "true");
    check("scrollspy marks Experience", afterScroll.current.trim() === "Experience", afterScroll.current);
    check("nav switches to its scrolled state", afterScroll.scrolled === "true");

    await shot("02-experience");

    /* --------------------------------------------- 4. pointer feedback */
    await evaluate(`document.getElementById("credentials").scrollIntoView({ behavior: "instant", block: "start" })`);
    await sleep(1600);

    const box = await evaluate(`(() => {
      const el = document.querySelector(".cert");
      const grid = el.closest("[data-reveal-group]");
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, transform: cs.transform,
               opacity: cs.opacity, reveal: !!(grid && grid.classList.contains("is-in")) };
    })()`);

    check("credentials revealed", box.reveal && box.opacity === "1", `grid is-in=${box.reveal} opacity=${box.opacity}`);

    await api.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y, button: "none" });
    await sleep(420);

    const hover = await evaluate(`(() => {
      const el = document.querySelector(".cert");
      const cs = getComputedStyle(el);
      return { lit: el.dataset.lit, mx: el.style.getPropertyValue("--mx"),
               transform: cs.transform, after: getComputedStyle(el, "::after").opacity };
    })()`);

    check("card spotlight follows the pointer", hover.lit === "true" && hover.mx !== "", `--mx=${hover.mx}`);
    check("card glow fades in", Number(hover.after) > 0.9, `opacity=${hover.after}`);
    check("card lifts on hover", hover.transform !== "none", hover.transform);

    await shot("03-credentials-hover");

    /* --------------------------------------------- 5. back-to-top works */
    await evaluate(`document.querySelector(".totop").click()`);
    await sleep(2200);
    const atTop = await evaluate(`Math.round(window.scrollY)`);
    check("back-to-top returns to the hero", atTop < 10, `scrollY=${atTop}`);

    /* ------------------------------------------------- 6. theme toggle */
    const before = await evaluate(`document.documentElement.dataset.theme`);
    await evaluate(`document.querySelector("[data-theme-toggle]").click(); true`);
    await sleep(170);
    const wiping = await evaluate(`({
      wipe: document.documentElement.classList.contains("theme-wipe"),
      theme: document.documentElement.dataset.theme,
    })`);
    await shot("04-theme-wipe");
    await sleep(900);
    const after = await evaluate(`document.documentElement.dataset.theme`);
    const wiped = await evaluate(`document.documentElement.classList.contains("theme-wipe")`);

    check("theme toggle flips the theme", before !== after, `${before} → ${after}`);
    check("theme swap runs as a view transition", wiping.wipe === true && wiped === false,
      `during=${wiping.wipe} after=${wiped}`);
    check(
      "view transitions available for the theme wipe",
      await evaluate(`typeof document.startViewTransition === "function"`)
    );
    await shot("04-theme-" + after);

    await evaluate(`document.getElementById("contact").scrollIntoView({ behavior: "instant", block: "start" })`);
    await sleep(1700);

    const mail = await evaluate(`(() => {
      const el = document.querySelector(".contact__mail");
      const cs = getComputedStyle(el);
      return { hover: el.matches(":hover"), focus: el.matches(":focus"),
               bg: cs.backgroundSize, color: cs.color, deco: cs.textDecorationLine };
    })()`);
    const underlined = mail.bg.indexOf("100%") === 0;
    check("contact email underline follows hover", mail.hover === underlined, JSON.stringify(mail));

    await shot("06-contact");

    /* ---------------------------------------------- 7. reduced motion */
    await api.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    await load(URL_UNDER_TEST);
    await sleep(700);

    const reduced = await evaluate(`(() => {
      const el = document.querySelectorAll(".timeline__item");
      const last = el[el.length - 1];
      const cs = getComputedStyle(last);
      return {
        motion: document.documentElement.dataset.motion,
        opacity: cs.opacity,
        translate: cs.translate,
      };
    })()`);

    check("reduced motion switches the layer off", reduced.motion === "off", reduced.motion);
    check(
      "nothing is left hidden under reduced motion",
      reduced.opacity === "1" && (reduced.translate === "none" || reduced.translate === "0px"),
      `opacity=${reduced.opacity} translate=${reduced.translate}`
    );

    await shot("05-reduced-motion");

    check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    }

    console.log("\nscreenshots in " + OUT_DIR);
  } finally {
    if (api) api.close();
    try {
      child.kill();
    } catch (e) {}
    await sleep(300);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error("probe failed: " + err.message);
  process.exit(1);
});

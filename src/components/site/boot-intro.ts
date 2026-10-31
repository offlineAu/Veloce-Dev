declare global {
  interface Window {
    __veloceIntro?: { mount(): void };
  }
}

/*
 * Homepage intro engine. It is serialised into the inline <head> script (BootInitScript), so it runs before React and
 * never waits for the JavaScript bundle: the intro plays as soon as the overlay's HTML has arrived, even on a slow
 * connection or a slow phone. That is why it must stay self-contained, with no imports or module-level references
 * (only its arguments and browser globals), and why it works on the server-rendered markup through data attributes.
 *
 * Flow: the head script calls this before paint, and it holds the page (data-intro="running"). The overlay, the first
 * thing the homepage streams, ends with a marker observed by the head script. Once the laptop has powered on (CSS), the
 * frames step through the laptop on the beat (124 BPM eighth notes), never ahead of the real load signals (DOM parsed, fonts ready, the
 * intro's images decoded, window load), then the last frame zooms to full bleed and the overlay dissolves into the hero.
 * If the document finishes parsing and the overlay never mounted, the page is released rather than left locked.
 */
export function bootIntro(storageKey: string) {
  const d = document.documentElement.dataset;
  if (d.booted) return;

  const WEIGHTS = { dom: 15, fonts: 25, images: 30, load: 30 };
  const STEP_MS = 242; // an eighth note at 124 BPM
  const MIN_BEATS = 8; // few frames hold for several beats each, so the sequence never feels rushed
  const SOFT_CAP = 94; // stay under 100 until every signal is in
  const GIVE_UP_MS = 6_000; // a stuck signal must not hold the intro open
  const START_MS = 1_100; // let the laptop rise and power on (device-in, power-on in boot-loader.module.css) first
  const HOLD_MS = 120;
  const DISSOLVE_AT_MS = 950; // when the overlay starts to fade (its transition-delay in boot-loader.module.css)
  const EXIT_MS = 1_700; // the dissolve's delay plus its duration

  const signals = { dom: false, fonts: false, images: false, load: false };
  let mounted = false;
  const release = () => {
    delete d.intro;
    d.booted = "1";
  };

  d.intro = "running";
  document.addEventListener("DOMContentLoaded", () => {
    signals.dom = true;
    tryMount();
    observer.disconnect();
    if (!mounted) release(); // the whole document is in and the overlay never appeared
  });
  window.addEventListener("load", () => { signals.load = true; });

  window.__veloceIntro = {
    mount() {
      if (mounted || d.booted) return;
      mounted = true;
      const root = document.querySelector<HTMLElement>("[data-boot-loader]");
      if (!root) return release();
      const q = (s: string) => root.querySelector<HTMLElement>(s);
      const device = q("[data-boot-device]");
      const screen = q("[data-boot-screen]");
      const status = q("[data-boot-status]");
      const captionEl = q("[data-boot-caption]");
      const glows = Array.from(root.querySelectorAll<HTMLElement>("[data-boot-glow]"));
      const titles = Array.from(root.querySelectorAll<HTMLElement>("[data-boot-frame]")).map((el) => el.dataset.title ?? "");
      const n = titles.length;
      const steps = Math.max(n - 1, 1);
      const beatsPerFrame = Math.max(1, Math.round(MIN_BEATS / steps));

      const pad = (v: number) => String(v).padStart(2, "0");
      const label = (p: number) => `[ ${pad(Math.floor(p))} Percent ]`;
      const caption = (i: number) => `${pad(i + 1)} / ${pad(n)}${titles[i] ? ` · ${titles[i]}` : ""}`;
      // Film position (0-1) for progress (0-100): each frame moves on at the start of its step, on the beat, then holds.
      const film = (p: number) => {
        if (n < 2) return 0;
        const x = (p / 100) * (n - 1);
        const i = Math.floor(x);
        const t = Math.min(1, (x - i) / 0.4);
        return Math.min(1, (i + t * t * (3 - 2 * t)) / (n - 1));
      };
      // The frame on screen: lights its glow in the backdrop and names it in the caption.
      const show = (i: number) => {
        glows.forEach((el, k) => { el.dataset.active = String(k === i); });
        if (captionEl) captionEl.textContent = caption(i);
      };
      const earned = () =>
        (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce((sum, k) => sum + (signals[k] ? WEIGHTS[k] : 0), 0);

      if (document.readyState !== "loading") signals.dom = true;
      if (document.readyState === "complete") signals.load = true;
      const imgs = Array.from(screen?.querySelectorAll("img") ?? []);
      Promise.all(imgs.map((img) => img.decode().catch(() => {}))).then(() => { signals.images = true; });

      const finish = () => {
        try {
          sessionStorage.setItem(storageKey, "1");
        } catch {
          /* private mode: the intro simply plays again next visit */
        }
        setTimeout(() => {
          // Move the screen's centre to the viewport's centre and scale it until it covers the viewport.
          const s = screen?.getBoundingClientRect();
          if (device && s?.width) {
            const box = device.getBoundingClientRect();
            const scale = 1.04 * Math.max(innerWidth / s.width, innerHeight / s.height);
            const cx = s.left + s.width / 2;
            const cy = s.top + s.height / 2;
            device.style.transformOrigin = `${cx - box.left}px ${cy - box.top}px`;
            device.style.setProperty("--zoom", `translate(${innerWidth / 2 - cx}px, ${innerHeight / 2 - cy}px) scale(${scale})`);
          }
          d.intro = "exit"; // unlocks scrolling; the hero headline still waits for the dissolve
          root.dataset.bootPhase = "exit";
        }, HOLD_MS);
        setTimeout(() => { d.intro = "reveal"; }, HOLD_MS + DISSOLVE_AT_MS); // the hero headline rises as it dissolves
        setTimeout(() => {
          root.dataset.bootPhase = "gone";
          release(); // client navigation back to "/" keeps it hidden
        }, HOLD_MS + EXIT_MS);
      };

      const start = () => {
        if (document.fonts) document.fonts.ready.then(() => { signals.fonts = true; }, () => { signals.fonts = true; });
        else signals.fonts = true;
        setTimeout(() => { signals.dom = signals.fonts = signals.images = signals.load = true; }, GIVE_UP_MS);

        d.intro = "playing";
        root.dataset.bootPhase = "playing";
        if (status) status.textContent = label(0);

        const t0 = performance.now();
        const beats = steps * beatsPerFrame;
        let beat = -1;
        const tick = (now: number) => {
          const e = earned();
          const p = Math.min(((now - t0) / (STEP_MS * beats)) * 100, e >= 100 ? 100 : Math.min(SOFT_CAP, e));
          if (status) status.textContent = label(p);
          root.style.setProperty("--p", String(film(p)));
          const b = Math.floor((p / 100) * beats);
          if (b > beat && p < 100) {
            beat = b;
            if (b % beatsPerFrame === 0) show(Math.min(n - 1, b / beatsPerFrame + 1)); // the frame now moving in
          }
          if (p >= 100) return finish();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      };

      setTimeout(start, START_MS);
    },
  };

  // A marker after the overlay guarantees its children exist even when HTML arrives in separate chunks.
  // The head script owns this observer, so client navigation does not insert an inert React script.
  const tryMount = () => {
    if (!document.querySelector("template[data-boot-ready]")) return;
    observer.disconnect();
    try { window.__veloceIntro?.mount(); } catch { release(); }
  };
  const observer = new MutationObserver(tryMount);
  observer.observe(document, { childList: true, subtree: true });
  tryMount();
}

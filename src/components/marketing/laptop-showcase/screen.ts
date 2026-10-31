import { portfolioImageUrl } from "@/lib/security/portfolio-images";
import { DEPLOY_STEPS, FILES, SNIPPETS, VERB, type ShowState, type ShowcaseItem } from "./store";

/**
 * The laptop display, drawn into a 2D canvas that becomes the screen mesh's texture: an editor typing the page, a
 * terminal deploying it, then the finished sample in a browser, with the trackpad's cursor on top. Drawn at 1280x800
 * (more than twice its size on the page), so text stays sharp.
 */
export const SCREEN_SIZE = { width: 1280, height: 800 } as const;
/** The phone's display, the shape of the phone screenshots (390x844 at 1.4x). */
export const PHONE_SIZE = { width: 540, height: 1169 } as const;

type Tone = "kw" | "str" | "tag" | "attr" | "punct" | "plain";
const TONE: Record<Tone, string> = { kw: "#c792ea", str: "#c3e88d", tag: "#82aaff", attr: "#ffcb6b", punct: "#89ddff", plain: "#d6deeb" };

/** A small highlighter for the snippets: keywords, strings, JSX tags and attributes. */
function tokenize(code: string) {
  const out: { text: string; tone: Tone }[] = [];
  let i = 0;
  while (i < code.length) {
    const rest = code.slice(i);
    const kw = rest.match(/^(export|default|function|return)\b/);
    const str = rest.match(/^"[^"]*"/);
    const tag = rest.match(/^<\/?[A-Z][A-Za-z]*/);
    const attr = /[\s(]$/.test(code.slice(0, i)) ? rest.match(/^[a-z]+(?==|\s|\n)/) : null;
    const [text, tone]: [string, Tone] = kw ? [kw[0], "kw"] : str ? [str[0], "str"] : tag ? [tag[0], "tag"] : attr ? [attr[0], "attr"] : [rest[0]!, /^[{}()<>/;=]/.test(rest) ? "punct" : "plain"];
    out.push({ text, tone });
    i += text.length;
  }
  return out;
}
const tokenCache = new Map<string, ReturnType<typeof tokenize>>();
const tokensFor = (code: string) => tokenCache.get(code) ?? tokenCache.set(code, tokenize(code)).get(code)!;

const images = new Map<string, HTMLImageElement>();
/** A sample screenshot, loading once (same origin, so the canvas stays readable): the laptop's or the phone's. */
function imageFor(item: ShowcaseItem, onLoad: () => void, phone = false) {
  const src = portfolioImageUrl(phone && item.sample.phone ? item.sample.phone : item.sample.thumbnail);
  let img = images.get(src);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.onload = onLoad;
    img.src = src;
    images.set(src, img);
  }
  return img;
}
const glows = new Map<string, string>();
/**
 * The colour a sample's screen would cast: its screenshot's average colour (top two thirds, where the hero is), with
 * saturation and lightness lifted so it reads as light. Resolves once the image is loaded; cached per image.
 */
export function glowFor(item: ShowcaseItem): Promise<string> {
  const src = portfolioImageUrl(item.sample.thumbnail);
  const cached = glows.get(src);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const done = (img: HTMLImageElement) => {
      const c = document.createElement("canvas");
      c.width = c.height = 16;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight * 0.66, 0, 0, 16, 16);
      const d = ctx.getImageData(0, 0, 16, 16).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]!; g += d[i + 1]!; b += d[i + 2]!; }
      const n = d.length / 4;
      const [h, s] = toHsl(r / n, g / n, b / n);
      const glow = `hsl(${Math.round(h)} ${Math.round(Math.min(Math.max(s, 0.4), 0.5) * 100)}% 64%)`;
      glows.set(src, glow);
      resolve(glow);
    };
    const img = imageFor(item, () => done(img));
    if (img.complete && img.naturalWidth) done(img);
  });
}
function toHsl(r: number, g: number, b: number): [number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return [(h + 360) % 360, s];
}

export function preloadScreens(items: ShowcaseItem[], onLoad: () => void) {
  items.forEach((item) => { imageFor(item, onLoad); imageFor(item, onLoad, true); });
}

function dots(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + i * 26, y, 8, 0, Math.PI * 2); ctx.fill(); });
}

/**
 * Draws one frame. `siteMix` (0..1) cross-fades from the editor to the finished site; the scene eases it so the
 * reveal is smooth. `fonts.mono` is the page's mono stack.
 */
export function drawScreen(ctx: CanvasRenderingContext2D, s: ShowState, item: ShowcaseItem, siteMix: number, fonts: { mono: string; sans: string }, onImage: () => void) {
  const { width: W, height: H } = SCREEN_SIZE;
  const code = SNIPPETS[item.kind];
  const typed = s.phase === "code" ? s.typed : code.length;
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#1b1d24";
  ctx.fillRect(0, 0, W, H);

  // Editor: title bar with the file tab, line numbers, highlighted code and a caret.
  ctx.fillStyle = "#14161d";
  ctx.fillRect(0, 0, W, 64);
  dots(ctx, 32, 32);
  ctx.fillStyle = "#1b1d24";
  ctx.fillRect(130, 14, 270, 50);
  ctx.font = `500 24px ${fonts.sans}`;
  ctx.fillStyle = "#d6deeb";
  ctx.textBaseline = "middle";
  ctx.fillText(FILES[item.kind], 154, 40);

  ctx.font = `400 30px ${fonts.mono}`;
  ctx.textBaseline = "alphabetic";
  const lineH = 48;
  const lines = code.split("\n").length;
  ctx.fillStyle = "#4b5263";
  ctx.textAlign = "right";
  for (let l = 0; l < lines; l++) ctx.fillText(String(l + 1), 70, 120 + l * lineH);
  ctx.textAlign = "left";
  let x = 100;
  let y = 120;
  let count = 0;
  for (const t of tokensFor(code)) {
    for (const ch of t.text) {
      if (count >= typed) break;
      count++;
      if (ch === "\n") { x = 100; y += lineH; continue; }
      ctx.fillStyle = TONE[t.tone];
      ctx.fillText(ch, x, y);
      x += ctx.measureText(ch).width;
    }
  }
  if (s.phase === "code" && Math.floor(performance.now() / 500) % 2 === 0) {
    ctx.fillStyle = "#82aaff";
    ctx.fillRect(x + 2, y - 28, 14, 36);
  }

  // Terminal: the deploy log and a progress bar.
  if (s.phase !== "code") {
    const deployed = s.phase === "deploy" ? s.deployed : DEPLOY_STEPS - 1;
    const top = H - 230;
    ctx.fillStyle = "#14161d";
    ctx.fillRect(0, top, W, 230);
    ctx.fillStyle = "#2b3040";
    ctx.fillRect(0, top, W, 2);
    ctx.font = `400 22px ${fonts.sans}`;
    ctx.fillStyle = "#5c6370";
    ctx.fillText("Terminal", 40, top + 40);
    ctx.font = `400 28px ${fonts.mono}`;
    const log = [
      { text: "$ npm run deploy", tone: "#d6deeb" },
      { text: "✓ Built and checked in 2.4s", tone: "#c3e88d" },
      { text: `✓ Live at ${item.sample.slug}.veloceapp.dev`, tone: "#c3e88d" },
    ];
    log.slice(0, deployed + 1).forEach((l, i) => { ctx.fillStyle = l.tone; ctx.fillText(l.text, 40, top + 90 + i * 42); });
    ctx.fillStyle = "#2b3040";
    ctx.fillRect(40, H - 26, W - 80, 10);
    ctx.fillStyle = "#82aaff";
    ctx.fillRect(40, H - 26, (W - 80) * Math.min(1, (deployed + 1) / DEPLOY_STEPS), 10);
  }

  // The finished site in a browser window, fading in over the editor.
  if (siteMix > 0.001) {
    ctx.globalAlpha = siteMix;
    ctx.fillStyle = "#e9e9e4";
    ctx.fillRect(0, 0, W, H);
    dots(ctx, 32, 32);
    ctx.fillStyle = "#ffffffcc";
    const url = `${item.sample.slug}.veloceapp.dev`;
    ctx.font = `400 24px ${fonts.sans}`;
    const urlW = ctx.measureText(url).width + 48;
    ctx.beginPath();
    ctx.roundRect((W - urlW) / 2, 14, urlW, 38, 10);
    ctx.fill();
    ctx.fillStyle = "#555";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(url, W / 2, 34);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const img = imageFor(item, onImage);
    if (img.complete && img.naturalWidth) {
      const scale = W / img.naturalWidth;
      ctx.drawImage(img, 0, 0, img.naturalWidth, (H - 64) / scale, 0, 64, W, H - 64);
    }
    ctx.globalAlpha = 1;
  }

  // Trackpad cursor.
  if (s.cursor) {
    const cx = s.cursor.x * W;
    const cy = s.cursor.y * H;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(2, 2);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(15, 11); ctx.lineTo(8, 12); ctx.lineTo(12, 20); ctx.lineTo(9, 21); ctx.lineTo(5, 13); ctx.lineTo(0, 18);
    ctx.closePath();
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

const today = () => new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

/**
 * The phone beside the laptop: a lock screen whose notifications follow the build (started, deploying, live), then
 * the finished sample at phone size, fading in with the laptop's. Same arguments as drawScreen.
 */
export function drawPhone(ctx: CanvasRenderingContext2D, s: ShowState, item: ShowcaseItem, siteMix: number, fonts: { mono: string; sans: string }, onImage: () => void) {
  const { width: W, height: H } = PHONE_SIZE;
  ctx.globalAlpha = 1;
  const wall = ctx.createLinearGradient(0, 0, W, H);
  wall.addColorStop(0, "#28324a");
  wall.addColorStop(0.55, "#161b28");
  wall.addColorStop(1, "#0c0e14");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#e9edf5";
  ctx.font = `500 28px ${fonts.sans}`;
  ctx.fillText(today(), W / 2, 200);
  ctx.font = `600 156px ${fonts.sans}`;
  ctx.fillText("9:41", W / 2, 350);
  ctx.textAlign = "left";

  // Notifications from the build, newest on top.
  const live = s.phase === "site" || s.phase === "clear" || (s.phase === "deploy" && s.deployed >= DEPLOY_STEPS - 1);
  const notes = [{ title: "Build started", body: `Coding ${VERB[item.kind]}` }];
  if (s.phase !== "code") notes.unshift(live ? { title: "Deployed", body: `Live at ${item.sample.slug}.veloceapp.dev` } : { title: "Deploying", body: "Building and checking the site" });
  notes.forEach((n, i) => {
    const y = 430 + i * 150;
    ctx.fillStyle = "rgb(255 255 255 / 0.13)";
    ctx.beginPath();
    ctx.roundRect(24, y, W - 48, 132, 34);
    ctx.fill();
    ctx.fillStyle = "#1f4fd8";
    ctx.beginPath();
    ctx.roundRect(48, y + 30, 72, 72, 18);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `700 40px ${fonts.sans}`;
    ctx.textAlign = "center";
    ctx.fillText("V", 84, y + 81);
    ctx.textAlign = "left";
    ctx.font = `600 27px ${fonts.sans}`;
    ctx.fillText(n.title, 140, y + 58);
    ctx.font = `400 25px ${fonts.sans}`;
    ctx.fillStyle = "rgb(255 255 255 / 0.78)";
    let body = n.body;
    while (ctx.measureText(body).width > W - 190 && body.length > 4) body = `${body.slice(0, -2)}…`;
    ctx.fillText(body, 140, y + 96);
  });

  // The finished sample, as a phone shows it, under a status bar in the page's own colour.
  let bar = "#0c0e14";
  if (siteMix > 0.001) {
    ctx.globalAlpha = siteMix;
    const img = imageFor(item, onImage, true);
    if (img.complete && img.naturalWidth) {
      const top = 64;
      const scale = W / img.naturalWidth;
      const fit = Math.min(img.naturalHeight, (H - top) / scale);
      ctx.drawImage(img, 0, 0, img.naturalWidth, fit, 0, top, W, fit * scale);
      const [r, g, b] = ctx.getImageData(W / 2, top + 2, 1, 1).data;
      bar = `rgb(${r} ${g} ${b})`;
      ctx.fillStyle = bar;
      ctx.fillRect(0, 0, W, top);
    }
    ctx.globalAlpha = 1;
  }
  const [r, g, b] = bar.match(/\d+/g)!.map(Number) as [number, number, number];
  const light = siteMix > 0.5 && r * 0.3 + g * 0.59 + b * 0.11 > 150;
  ctx.fillStyle = light ? "#111" : "#fff";
  ctx.font = `600 26px ${fonts.sans}`;
  if (siteMix > 0.5) ctx.fillText("9:41", 52, 46);
  ctx.beginPath();
  ctx.roundRect(W - 92, 26, 46, 22, 6);
  ctx.fill();
  // The camera cut-out.
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.roundRect(W / 2 - 80, 16, 160, 44, 22);
  ctx.fill();
}

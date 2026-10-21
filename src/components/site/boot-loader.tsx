import { BOOT_STORAGE_KEY, INTRO_FAILSAFE_MS } from "./boot-constants";
import { BootLoaderClient, type IntroFrame } from "./boot-loader-client";

// Runs before first paint and decides whether the homepage intro shows at all. It is skipped (data-booted) when the
// visitor has seen it this session, asks for less motion (data-motion / data-perf are set just before by ThemeScope),
// the document did not load at "/" (client navigation to the homepage later never shows it), or the visitor is a
// crawler, Lighthouse or an automated browser: the intro waits for a click, and they would never get past it. They get
// the same page without the overlay. Otherwise data-intro locks scrolling and holds the hero headline's word rise (see
// globals.css), and a timer fades the overlay out and releases the page if the client has not hydrated in time.
// Rendered by the root layout, not inside BootLoader: a <script> that React creates on the client never runs.
const bootInitScript = `try{var d=document.documentElement.dataset,m=d.motion,r=m==="reduced"||(m!=="full"&&(matchMedia("(prefers-reduced-motion: reduce)").matches||d.perf==="lite")),a=navigator.webdriver||/bot|crawl|spider|slurp|lighthouse|headless|preview|externalhit/i.test(navigator.userAgent),s=!1;try{s=sessionStorage.getItem(${JSON.stringify(BOOT_STORAGE_KEY)})==="1"}catch(e){}if(s||r||a||location.pathname!=="/")d.booted="1";else{d.intro="running";setTimeout(function(){if(d.intro==="running"){d.intro="timeout";setTimeout(function(){delete d.intro;d.booted="1"},700)}},${INTRO_FAILSAFE_MS})}}catch(e){}`;

export function BootInitScript({ nonce }: { nonce?: string }) {
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: bootInitScript }} />;
}

/**
 * First-visit homepage intro (after theartofdocumentary.com's preloader): a dark screen asking the visitor to turn up
 * their volume and click to enter; the click starts a generated beat while the sample sites step through a laptop
 * screen in time with it, and the last frame, the hero's own photo, zooms to full bleed and dissolves into the page. The
 * page underneath is server-rendered in full the whole time. Server-rendered so there is no blank frame before hydration.
 */
export function BootLoader({ name, frames }: { name: string; frames: IntroFrame[] }) {
  return <BootLoaderClient name={name} frames={frames} />;
}

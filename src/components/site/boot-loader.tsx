import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { AUTOMATED_AGENT_PATTERN, BOOT_STORAGE_KEY } from "./boot-constants";
import { bootIntro } from "./boot-intro";
import styles from "./boot-loader.module.css";

/** One screen on the intro's laptop. `screen`: a website capture, pinned to its top rather than centred. */
export type IntroFrame = { src: string; title: string; screen: boolean };

// Runs before first paint and decides whether the homepage intro shows at all. It is skipped (data-booted) when the
// visitor has seen it this session, asks for less motion (data-motion / data-perf are set just before by ThemeScope),
// the document did not load at "/" (client navigation to the homepage later never shows it), or the visitor is a
// crawler, Lighthouse or an automated browser. They get the same page without the overlay. Otherwise it starts the intro engine (boot-intro.ts), which runs the whole intro
// without React, so neither the bundle nor hydration can hold it up.
// Rendered by the root layout, not inside BootLoader: a <script> that React creates on the client never runs.
const bootInitScript = `try{var d=document.documentElement.dataset,m=d.motion,r=m==="reduced"||(m!=="full"&&(matchMedia("(prefers-reduced-motion: reduce)").matches||d.perf==="lite")),a=navigator.webdriver||/${AUTOMATED_AGENT_PATTERN}/i.test(navigator.userAgent),s=!1;try{s=sessionStorage.getItem(${JSON.stringify(BOOT_STORAGE_KEY)})==="1"}catch(e){}if(s||r||a||location.pathname!=="/")d.booted="1";else(${bootIntro.toString()})(${JSON.stringify(BOOT_STORAGE_KEY)})}catch(e){document.documentElement.dataset.booted="1"}`;

export function BootInitScript({ nonce }: { nonce?: string }) {
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: bootInitScript }} />;
}

const caption = (frames: IntroFrame[], i: number) =>
  `${String(i + 1).padStart(2, "0")} / ${String(frames.length).padStart(2, "0")}${frames[i]?.title ? ` · ${frames[i].title}` : ""}`;

/**
 * First-visit homepage intro (after theartofdocumentary.com's preloader): it starts on its own as the page loads, the
 * sample sites step through a laptop screen on a steady beat, and the last frame, the hero's own photo, zooms to full
 * bleed and dissolves into the page. It is decorative, so it is hidden from assistive technology.
 * Server-rendered markup only: the head script's engine (boot-intro.ts) drives it, so it plays before hydration. The
 * homepage renders this ahead of its data, so it is the first thing to arrive. Elements the engine changes are marked
 * suppressHydrationWarning, because the visitor may already be watching the sequence when React hydrates.
 */
export function BootLoader({ name, frames }: { name: string; frames: IntroFrame[] }) {
  return (
    <>
      <div
        data-boot-loader="" data-boot-phase="loading" className={styles.wrapper} aria-hidden
        style={{ "--n": frames.length } as CSSProperties}
        suppressHydrationWarning
      >
        <div className={styles.bg}>
          {/* The frame on screen, blurred into a glow around the laptop. */}
          <div className={styles.ambient}>
            {frames.map((f, i) => (
              <div key={f.src} data-boot-glow="" data-active={String(i === 0)} suppressHydrationWarning>
                <Image src={f.src} alt="" fill sizes="64px" loading="eager" fetchPriority="low" className={cn("object-cover", f.screen && "object-top")} />
              </div>
            ))}
          </div>
          <div className={styles.grid} />
          <div className={styles.grain} />
        </div>

        <div className={styles.layout}>
          <span className={styles.label}><span>[ {name} ]</span></span>
          <div data-boot-device="" className={styles.device} suppressHydrationWarning>
            <div className={styles.lid}>
              <div data-boot-screen="" className={styles.screen}>
                <div className={styles.column}>
                  {frames.map((f) => (
                    <div key={f.src} data-boot-frame="" data-title={f.title} className={styles.frame}>
                      <Image
                        src={f.src} alt="" fill sizes="(max-width: 640px) 80vw, 560px" loading="eager" fetchPriority="low"
                        className={cn("object-cover", f.screen && "object-top")}
                      />
                    </div>
                  ))}
                </div>
                <div className={styles.loadbar}><span /></div>
              </div>
            </div>
            <div className={styles.base} />
            <p data-boot-caption="" className={cn(styles.caption, "tabular-nums")} suppressHydrationWarning>{caption(frames, 0)}</p>
          </div>
          <span className={styles.label}>
            <span data-boot-status="" className="tabular-nums" suppressHydrationWarning>{"[ 00 Percent ]"}</span>
          </span>
        </div>
      </div>
      <template data-boot-ready="" />
    </>
  );
}

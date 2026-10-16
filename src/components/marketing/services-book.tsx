"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { m } from "framer-motion";
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, List, RotateCcw, X } from "lucide-react";
import { servicePaths, type ServiceItem } from "@/content/site";
import { servicePageHref } from "@/content/seo";
import { LogoMark } from "@/components/brand/logo";
import { OpenInquiryButton } from "@/components/forms/inquiry";
import { Icon } from "@/components/ui/icon";
import { prefersReducedMotion, useReducedMotion } from "@/lib/use-reduced-motion";
import { ServicesExplorer } from "./services-explorer";
import styles from "./services-book.module.css";

const TURN_DURATION = 1.3;
const COVER_DURATION = 1.5;
const BOOK_EASE: [number, number, number, number] = [.37, 0, .25, 1];

const category = (slug: string) => servicePaths.find((path) => (path.slugs as readonly string[]).includes(slug));

function ServiceArtwork({ service, number }: { service: ServiceItem; number: number }) {
  return <>
    <div className={styles.leafTop}><LogoMark className={styles.smallMark} /><span>Veloce / Services</span></div>
    <div className={styles.art} aria-hidden="true"><div className={styles.orbit} /><Icon name={service.icon} className={styles.serviceIcon} /><span className={styles.largeNumber}>{String(number).padStart(2, "0")}</span></div>
    <p className={styles.benefit}>{service.benefit || "Built around your business."}</p>
    <span className={styles.folio}>{category(service.slug)?.label ?? "Other services"}</span>
  </>;
}

function ServiceDetail({ service, number, titleId, refToken }: { service: ServiceItem; number: number; titleId: string; refToken?: string }) {
  const href = servicePageHref(service.slug, refToken);
  return <>
    <article className={styles.pageArticle} aria-labelledby={titleId}>
      <p className={styles.eyebrow}>{category(service.slug)?.label ?? "Other services"}</p>
      <span className={styles.mobileIcon} aria-hidden><Icon name={service.icon} /></span>
      <h3 id={titleId}>{service.title}</h3>
      <p className={styles.mobileBenefit}>{service.benefit}</p>
      <p className={styles.description}>{service.description}</p>
      <div className={styles.actions}>
        <OpenInquiryButton service={{ slug: service.slug, title: service.title }} aria-label={`Ask about ${service.title}`}>Ask about this <ArrowRight aria-hidden className="size-4" /></OpenInquiryButton>
        {href ? <Link href={href} className={styles.detailLink}>Explore this service <ArrowRight aria-hidden /></Link> : null}
      </div>
    </article>
    <div className={styles.pageFooter}><span>Built around your business.</span><span>{String(number).padStart(2, "0")}</span></div>
  </>;
}

export function ServicesBook({ services, refToken }: { services: ServiceItem[]; refToken?: string }) {
  const [opened, setOpened] = useState(false);
  const [coverPhase, setCoverPhase] = useState<"closed" | "opening" | "open" | "closing">("closed");
  const [list, setList] = useState(false);
  const [selected, setSelected] = useState(services[0]?.slug);
  const [flip, setFlip] = useState<{ from: ServiceItem; to: ServiceItem; direction: number; sequence: number } | null>(null);
  const reduce = useReducedMotion();
  const id = useId();
  const pageRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const modeRef = useRef<HTMLButtonElement>(null);
  const flipSequence = useRef(0);
  const pendingService = useRef<string | null>(null);
  const index = Math.max(0, services.findIndex((service) => service.slug === selected));
  const service = services[index];
  const isOpen = opened || reduce;
  const groups = [...servicePaths.map((path) => ({ label: path.label, items: services.filter((s) => category(s.slug)?.id === path.id) })),
    { label: "Other services", items: services.filter((s) => !category(s.slug)) }].filter((group) => group.items.length);

  function openBook() {
    setOpened(true);
    if (!reduce) setCoverPhase("opening");
    requestAnimationFrame(() => { (nextRef.current?.disabled ? modeRef.current : nextRef.current)?.focus({ preventScroll: true }); });
  }

  function choose(next: number) {
    const target = services[Math.min(services.length - 1, Math.max(0, next))];
    if (!target || !service) return;
    if (pageRef.current?.contains(document.activeElement)) nextRef.current?.focus({ preventScroll: true });
    setSelected(target.slug);
    if (!isOpen || (!reduce && coverPhase !== "open")) {
      pendingService.current = null;
      setFlip(null);
      if (!isOpen) openBook();
      return;
    }
    if (reduce) return;
    if (flip) {
      // Keep the current sheet moving; remember the latest requested destination.
      pendingService.current = target.slug;
    } else if (target.slug !== service.slug) {
      setFlip({ from: service, to: target, direction: services.indexOf(target) > services.indexOf(service) ? 1 : -1, sequence: ++flipSequence.current });
    }
  }

  function finishTurn(sequence: number) {
    if (!flip || flip.sequence !== sequence) return;
    const target = services.find(item => item.slug === pendingService.current);
    pendingService.current = null;
    if (target && target.slug !== flip.to.slug) {
      setFlip({ from: flip.to, to: target, direction: services.indexOf(target) > services.indexOf(flip.to) ? 1 : -1, sequence: ++flipSequence.current });
    } else {
      setFlip(null);
    }
  }

  function close() {
    if (flip) setSelected(flip.to.slug);
    setOpened(false);
    setCoverPhase("closing");
    setFlip(null);
    pendingService.current = null;
    // Keep the current spread under the cover until it has reached the closed position.
  }

  function finishCover() {
    if (opened) {
      setCoverPhase("open");
    } else if (coverPhase === "closing") {
      setCoverPhase("closed");
      setSelected(services[0]?.slug);
      openRef.current?.focus({ preventScroll: true });
    }
  }

  function switchMode() {
    setList(!list);
    setFlip(null);
    pendingService.current = null;
    if (opened) setCoverPhase("open");
    requestAnimationFrame(() => {
      const button = modeRef.current;
      button?.focus({ preventScroll: true });
      const toolbar = button?.parentElement;
      if (!toolbar) return;
      const bounds = toolbar.getBoundingClientRect();
      const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      // Preserve a visible toolbar; bring it below the header only if the new layout hides it.
      if (bounds.top < offset || bounds.bottom > innerHeight) {
        toolbar.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "instant" : "smooth" });
      }
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    // Dialog events can bubble through React portals. Leave their keyboard handling alone.
    if (!event.currentTarget.contains(target) || target.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
    if (!isOpen || list || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      choose(index + (event.key === "ArrowRight" ? 1 : -1));
    }
    if (event.key === "Escape" && !reduce) { event.preventDefault(); close(); }
  }

  if (!service) return <p className="mt-8 text-muted">Tell us what you need to build. <OpenInquiryButton variant="ghost">Start a conversation</OpenInquiryButton></p>;

  const visibleService = flip?.to ?? service;
  const leftService = flip ? (flip.direction > 0 ? flip.from : flip.to) : service;
  const rightService = flip ? (flip.direction > 0 ? flip.to : flip.from) : service;
  const pageNumber = (item: ServiceItem) => services.indexOf(item) + 1;
  return (
    <div className={styles.root} data-services-book onKeyDown={onKeyDown}>
      <div className={styles.toolbar}>
        <span className={styles.eyebrow}>The Veloce service book</span>
        <button ref={modeRef} type="button" className={styles.textButton} aria-pressed={list} onClick={switchMode}>
          {list ? <BookOpen aria-hidden /> : <List aria-hidden />}{list ? "View service book" : "View all services"}
        </button>
      </div>
      {list ? <ServicesExplorer services={services} refToken={refToken} /> : (
        <div className={styles.layout}>
          <aside className={styles.contents} aria-label="Service book contents">
            <p className={styles.eyebrow}>Contents</p>
            <h3>Find your next chapter.</h3>
            <p className={styles.intro}>Start with what your business needs. We’ll work out the right scope together.</p>
            <label className={styles.mobileContents}>Choose a service
              <select value={isOpen ? index : ""} aria-controls={`${id}-page`} onChange={(event) => choose(Number(event.target.value))}>
                <option value="" disabled>Open a chapter…</option>
                {groups.map((group) => <optgroup key={group.label} label={group.label}>{group.items.map((item) => <option key={item.slug} value={services.indexOf(item)}>{item.title}</option>)}</optgroup>)}
              </select>
            </label>
            <div className={styles.chapters}>
              {groups.map((group) => <div key={group.label}>
                <p className={styles.groupLabel}>{group.label}</p>
                {group.items.map((item) => <button key={item.slug} type="button" aria-controls={`${id}-page`} aria-current={isOpen && service.slug === item.slug ? "page" : undefined} onClick={() => choose(services.indexOf(item))}>
                  <span>{String(services.indexOf(item) + 1).padStart(2, "0")}</span>{item.title}<ArrowRight aria-hidden />
                </button>)}
              </div>)}
            </div>
          </aside>
          <div className={styles.reader}>
            <div className={styles.stage} data-open={isOpen} data-cover-phase={reduce ? "open" : coverPhase} data-static={reduce}>
              <div className={styles.bookFrame}>
              <div className={styles.spread} ref={pageRef} id={`${id}-page`} inert={!isOpen} aria-hidden={!isOpen}>
                {services.map(item => <div key={`size-${item.slug}`} className={`${styles.rightLeaf} ${styles.pageSizer}`} aria-hidden="true" inert>
                  <ServiceDetail service={item} number={pageNumber(item)} titleId={`${id}-size-${pageNumber(item)}`} refToken={refToken} />
                </div>)}
                <div className={styles.leftLeaf}>
                  <button type="button" className={styles.pageTurn} aria-label="Turn to previous service" aria-controls={`${id}-page`} disabled={index === 0} onClick={() => choose(index - 1)} />
                  <ServiceArtwork service={leftService} number={pageNumber(leftService)} />
                </div>
                <div className={styles.rightLeaf}>
                  <button type="button" className={styles.pageTurn} aria-label="Turn to next service" aria-controls={`${id}-page`} disabled={index === services.length - 1} onClick={() => choose(index + 1)} />
                  <ServiceDetail service={rightService} number={pageNumber(rightService)} titleId={`${id}-title`} refToken={refToken} />
                </div>
                {isOpen && !reduce && flip && <m.div key={`shadow-${flip.sequence}`} aria-hidden="true" className={styles.castShadow}
                  style={{ left: flip.direction > 0 ? 0 : "50%", transformOrigin: flip.direction > 0 ? "right" : "left", background: `linear-gradient(${flip.direction > 0 ? "90deg" : "270deg"}, transparent, #201e1d)` }}
                  initial={{ opacity: 0, scaleX: .15 }} animate={{ opacity: [0, .28, 0], scaleX: [.15, 1, .15] }} transition={{ duration: TURN_DURATION, ease: BOOK_EASE }} />}
                {isOpen && !reduce && flip && <m.div key={flip.sequence} data-page-turn={flip.sequence} aria-hidden="true" inert className={styles.turningLeaf}
                  initial={{ rotateY: flip.direction > 0 ? 0 : -180 }}
                  animate={{ rotateY: flip.direction > 0 ? -180 : 0, boxShadow: ["0 0 0 #201e1d00", "24px 30px 48px #201e1d55", "0 0 0 #201e1d00"] }}
                  transition={{ duration: TURN_DURATION, ease: BOOK_EASE }}
                  onAnimationComplete={() => finishTurn(flip.sequence)}>
                  <div className={styles.flipFront}>
                    <ServiceDetail service={flip.direction > 0 ? flip.from : flip.to} number={pageNumber(flip.direction > 0 ? flip.from : flip.to)} titleId={`${id}-turn-title`} refToken={refToken} />
                    <m.span className={styles.flipShade} initial={{ opacity: 0 }} animate={{ opacity: [0, .24, 0] }} transition={{ duration: TURN_DURATION }} />
                  </div>
                  <div className={styles.flipBack}>
                    <ServiceArtwork service={flip.direction > 0 ? flip.to : flip.from} number={pageNumber(flip.direction > 0 ? flip.to : flip.from)} />
                    <m.span className={styles.flipShade} initial={{ opacity: 0 }} animate={{ opacity: [0, .22, 0] }} transition={{ duration: TURN_DURATION }} />
                  </div>
                </m.div>}
              </div>
                <m.div className={styles.cover} inert={isOpen} aria-hidden={isOpen} hidden={reduce} data-book-cover initial={false}
                  animate={{ rotateY: isOpen ? -180 : 0 }} transition={{ duration: reduce ? 0 : COVER_DURATION, ease: BOOK_EASE }} onAnimationComplete={finishCover}>
                  <div className={styles.coverFront}>
                  <span className={styles.coverGrain} aria-hidden="true" />
                  <div className={styles.coverTop}><LogoMark className={styles.smallMark} /><span>Veloce</span></div>
                  <div className={styles.coverArt} aria-hidden><LogoMark /></div>
                  <div className={styles.coverCopy}><p className={styles.coverEyebrow}>A practical guide to what we build</p><h3>Explore every<br />service.</h3>
                    <span className={styles.coverPrompt} aria-hidden="true">Open service book <ArrowRight /></span>
                  </div>
                  <span className={styles.coverFooter}>{services.length} services. Your next possibility.</span>
                  <button ref={openRef} type="button" className={styles.coverTarget} aria-label="Open service book" aria-expanded={isOpen} aria-controls={`${id}-page`} onClick={openBook} />
                  </div>
                  <div className={styles.coverBack} aria-hidden="true"><ServiceArtwork service={visibleService} number={pageNumber(visibleService)} /></div>
                </m.div>
              </div>
            </div>
            <div className={styles.controls}>
              <button type="button" className={styles.iconButton} aria-label="Previous service" disabled={!isOpen || index === 0} onClick={() => choose(index - 1)}><ChevronLeft aria-hidden /></button>
              <p role="status" aria-live="polite" aria-atomic="true">{isOpen ? `${index + 1} / ${services.length} · ${service.title}` : "Open the book or choose a service"}</p>
              <button ref={nextRef} type="button" className={styles.iconButton} aria-label="Next service" disabled={!isOpen || index === services.length - 1} onClick={() => choose(index + 1)}><ChevronRight aria-hidden /></button>
            </div>
            {isOpen && <p className={styles.turnHint}>Turn the page to explore <ArrowRight aria-hidden /></p>}
            {isOpen && <div className={styles.readerTools}>
              <button type="button" className={styles.textButton} onClick={() => choose(0)}><RotateCcw aria-hidden />Back to the beginning</button>
              {!reduce && <button type="button" className={styles.textButton} onClick={close}><X aria-hidden />Close book</button>}
            </div>}
          </div>
        </div>
      )}
      <noscript><div className={styles.fallback}>
        {services.map((item) => <article key={item.slug}><h3>{item.title}</h3><p>{item.description}</p>{servicePageHref(item.slug, refToken) ? <a href={servicePageHref(item.slug, refToken)}>Explore this service</a> : null}</article>)}
      </div><style>{`[data-services-book] > :not(noscript) { display: none !important; }`}</style></noscript>
    </div>
  );
}

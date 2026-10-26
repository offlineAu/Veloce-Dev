import { portfolioImageUrl } from "@/lib/security/portfolio-images";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Clock3, Code2, Globe2, HandHeart, Handshake, Languages, Lightbulb, MapPin, MessageCircle, UserRound } from "lucide-react";
import type { ContentSearchParams } from "@/components/marketing/content-page";
import { InquiryProvider, OpenInquiryButton } from "@/components/forms/inquiry";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { BreadcrumbData } from "@/components/site/structured-data";
import { PhilippineSun, IslandWaves } from "@/components/about/philippine-motifs";
import { aboutGoals } from "@/content/site";
import { servicePages, withReferral } from "@/content/seo";
import { pageMetadata } from "@/lib/seo";
import { getCompanyProfile } from "@/server/services/company";
import { getPublicCampaign } from "@/server/services/campaign";
import styles from "@/components/about/about-page.module.css";

export const metadata = pageMetadata(
  "About Veloce | Freelance Development in the Philippines",
  "Get to know Veloce, an independent freelance development practice rooted in the Philippines. Practical websites and systems, clear communication, and thoughtful work.",
  "/about",
);

const photos = {
  palawan: { author: "nennnn", source: "https://commons.wikimedia.org/wiki/File:El_Nido_Palawan_Big_Lagoon.jpg", licence: "CC BY 2.0", licenceUrl: "https://creativecommons.org/licenses/by/2.0/" },
  terraces: { author: "M0N FEDERE MD", source: "https://commons.wikimedia.org/wiki/File:Batad_Rice_Terraces.jpg", licence: "CC BY-SA 3.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0/" },
  bohol: { author: "Theglennpalacio", source: "https://commons.wikimedia.org/wiki/File:Bohol_-_Chocolate_Hills.jpg", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/" },
};

function PhotoCredit({ photo }: { photo: (typeof photos)[keyof typeof photos] }) {
  return <span className={styles.photoCredit}>Photo: <a href={photo.source} target="_blank" rel="noopener noreferrer">{photo.author}</a><span aria-hidden="true"> · </span><a href={photo.licenceUrl} target="_blank" rel="noopener noreferrer">{photo.licence}</a></span>;
}

const values = [
  { word: "Malasakit", translation: "Care in the details", icon: HandHeart },
  { word: "Diskarte", translation: "A practical way forward", icon: Lightbulb },
  { word: "Bayanihan", translation: "Progress through collaboration", icon: Handshake },
];

export default async function AboutPage({ searchParams }: { searchParams: ContentSearchParams }) {
  const sp = await searchParams;
  const ref = Array.isArray(sp.ref) ? sp.ref[0] : sp.ref;
  const [company, campaign] = await Promise.all([getCompanyProfile(), ref ? getPublicCampaign(ref) : Promise.resolve(null)]);
  const refToken = campaign?.token;
  const links = [
    { label: "Services", href: withReferral("/#services", refToken) },
    { label: "Approach", href: "#approach" },
    { label: "About", href: withReferral("/about", refToken) },
    { label: "Contact", href: "#contact" },
  ];
  return (
    <InquiryProvider companyName={company.name} contactEmail={company.contactEmail} refToken={refToken} introducedBy={campaign?.referrerName}>
      <SiteHeader companyName={company.name} compactOnScroll={false} homeHref={withReferral("/", refToken)} links={links} menuCta={<OpenInquiryButton>Start a conversation</OpenInquiryButton>} />
      <BreadcrumbData label="About" path="/about" />
      <main id="main" className={styles.page}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href={withReferral("/", refToken)}>Home</Link><span aria-hidden="true">/</span><span aria-current="page">About</span></nav>

        <section className={styles.hero} aria-labelledby="about-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span className={styles.smallSun}><PhilippineSun /></span>Mabuhay. This is Veloce.</p>
            <h1 id="about-title">Philippine roots.<br />Practical <span className={styles.underlined}>thinking.</span></h1>
            <p className={styles.heroIntro}>Independent development, with a little Filipino heart. Websites and systems built around your business, with care for the people who use them.</p>
            <div className={styles.heroActions}><OpenInquiryButton variant="dark">Discuss your project<ArrowUpRight size={17} aria-hidden="true" /></OpenInquiryButton><a href="#story" className={styles.textLink}>A little about Veloce<ArrowDown size={15} aria-hidden="true" /></a></div>
            <p className={styles.origin}><MapPin size={14} aria-hidden="true" />Based in the Philippines. Working remotely.</p>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.sunStamp}><PhilippineSun /><span>Rooted in<br />the Philippines</span></div>
            <figure className={styles.postcard}>
              <div className={styles.heroImage}><Image src={portfolioImageUrl("/images/about/el-nido.webp")} alt="Turquoise water and limestone cliffs at Big Lagoon in El Nido, Palawan" fill sizes="(max-width: 760px) 90vw, (max-width: 1100px) 48vw, 600px" preload /></div>
              <figcaption><div className={styles.location}><MapPin size={14} aria-hidden="true" /><span>El Nido, Palawan</span><span className={styles.locationNumber}>01 / PH</span></div><PhotoCredit photo={photos.palawan} /></figcaption>
            </figure>
            <IslandWaves className={styles.heroWaves} />
          </div>
        </section>

        <div className={styles.facts} aria-label="Working with Veloce">
          <div><UserRound size={19} aria-hidden="true" /><p><strong>Independent by design</strong><span>Work directly with the developer.</span></p></div>
          <div><Clock3 size={19} aria-hidden="true" /><p><strong>Philippine Time · UTC+8</strong><span>Review times agreed together.</span></p></div>
          <div><Languages size={19} aria-hidden="true" /><p><strong>Clear communication</strong><span>Remote collaboration in English.</span></p></div>
        </div>

        <section id="story" className={styles.story} aria-labelledby="purpose-title">
          <div><p className={styles.eyebrow}>01 / The story</p><h2 id="purpose-title">Good work starts<br />with <span>understanding.</span></h2><IslandWaves className={styles.storyWaves} /></div>
          <div className={styles.storyCopy}><p className={styles.largeCopy}>Veloce is an independent freelance development practice based in the Philippines. The aim is simple: turn ideas and everyday challenges into software that’s useful.</p><p>That might mean a clearer website, a smoother booking process, or a system that takes repetitive work off your hands. It starts by understanding what you need, what you already have, and what would make the biggest difference.</p><p>You work directly with the person building it. Clear priorities, working previews, and straightforward conversations keep the work grounded in your business.</p><a href="#approach" className={styles.textLink}>How that shows up in the work<ArrowDown size={15} aria-hidden="true" /></a></div>
        </section>

        <section className={styles.landscapes} aria-labelledby="landscapes-title">
          <div className={styles.sectionIntro}><div><p className={styles.eyebrow}>A sense of place</p><h2 id="landscapes-title">A little perspective<br />from home.</h2></div><p>From the terraces of Ifugao to the hills of Bohol, there’s plenty here to make you pause and look a little closer.</p></div>
          <div className={styles.landscapeGrid}>
            <figure className={styles.terraces}><div className={styles.landscapeImage}><Image src={portfolioImageUrl("/images/about/batad-terraces.webp")} alt="Layered rice terraces following the mountainside in Batad, Ifugao" fill sizes="(max-width: 760px) 90vw, 56vw" /></div><figcaption><div className={styles.location}><span className={styles.locationNumber}>02</span><span>Batad rice terraces</span><span className={styles.region}>Ifugao, Luzon</span></div><PhotoCredit photo={photos.terraces} /></figcaption></figure>
            <figure className={styles.hills}><div className={styles.landscapeImage}><Image src={portfolioImageUrl("/images/about/chocolate-hills.webp")} alt="Green rounded Chocolate Hills stretching beneath a cloudy sky in Bohol" fill sizes="(max-width: 760px) 90vw, 38vw" /></div><figcaption><div className={styles.location}><span className={styles.locationNumber}>03</span><span>Chocolate Hills</span><span className={styles.region}>Bohol, Visayas</span></div><PhotoCredit photo={photos.bohol} /></figcaption><p className={styles.landscapeNote}><PhilippineSun /><span>Different landscapes.<br />One place to call home.</span></p></figure>
          </div>
          <p className={styles.imageNote}>Photography resized and cropped for this layout. Original images and licences are linked above.</p>
        </section>

        <section id="approach" className={styles.approach} aria-labelledby="goals-title">
          <div className={styles.sectionIntro}><div><p className={styles.eyebrow}>02 / The approach</p><h2 id="goals-title">Filipino heart.<br />Thoughtful work.</h2></div><p>A few familiar values, put into practice through clear decisions, useful software, and a collaborative way of working.</p></div>
          <ol className={styles.values}>{values.map(({ word, translation, icon: Icon }, index) => <li key={word}><div className={styles.valueTop}><Icon size={27} strokeWidth={1.4} aria-hidden="true" /><span>0{index + 1}</span></div><p className={styles.valueWord} lang="fil">{word}</p><p className={styles.translation}>{translation}</p><h3>{aboutGoals[index]!.title}</h3><p className={styles.valueBody}>{aboutGoals[index]!.body}</p></li>)}</ol>
        </section>

        <section className={styles.collaboration} aria-labelledby="remote-title">
          <div className={styles.collaborationDrawing}><div className={styles.drawingWindow}><div><i /><i /><i /><span>From PH, with care</span></div><Code2 size={58} strokeWidth={1} /><p>Think it.<br />Build it.<br /><span>Make it work.</span></p><IslandWaves /></div><PhilippineSun className={styles.windowSun} /></div>
          <div><p className={styles.eyebrow}>03 / Working together</p><h2 id="remote-title">A direct line to the<br />person building it.</h2><p className={styles.collaborationIntro}>Close collaboration doesn’t need the same postcode.</p><p>Work remotely in English with a developer based in the Philippines. At the start, we agree on communication channels, review times, and who provides the content and feedback.</p><div className={styles.collaborationDetails}><span><Globe2 size={16} aria-hidden="true" />Based in the Philippines</span><span><MessageCircle size={16} aria-hidden="true" />Direct communication</span></div></div>
        </section>

        <section id="contact" className={styles.contact} aria-labelledby="contact-title"><div><p className={styles.eyebrow}>Your next chapter</p><h2 id="contact-title">Let’s build something<br /><span>that works for you.</span></h2><p>A website, a workflow, or an idea you’re still figuring out.<br />A conversation is a good place to start.</p><div className={styles.contactActions}><OpenInquiryButton>Start a conversation<ArrowUpRight size={17} aria-hidden="true" /></OpenInquiryButton><a href={`mailto:${company.contactEmail}`}>{company.contactEmail}</a></div></div><div className={styles.contactSun}><PhilippineSun /><span>Philippine roots.<br />Room to grow.</span></div></section>
        <nav aria-label="Explore website services" className={styles.services}><span>Explore the work</span>{servicePages.map(page => <Link key={page.slug} href={withReferral(`/services/${page.slug}`, refToken)}>{page.label}<ArrowRight size={14} aria-hidden="true" /></Link>)}</nav>
      </main>
      <SiteFooter {...company} email={company.contactEmail} showContacts={false} contactHref="#contact" columns={[{ title: "Website services", links: servicePages.map(page => ({ label: page.label, href: withReferral(`/services/${page.slug}`, refToken) })) }, { title: "Veloce", links: [{ label: "About", href: withReferral("/about", refToken) }] }]} />
    </InquiryProvider>
  );
}

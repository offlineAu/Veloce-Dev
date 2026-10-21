import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { CASE_FILE, CASE_SLUG, currentCaseGrant } from "@/server/portfolio/access";
import { InvitationForm } from "./invitation-form";
import { leaveCase } from "./actions";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Private case study", robots: { index: false, follow: false, nocache: true } };
export default async function PrivateCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!CASE_SLUG.test(slug) || slug.length > 60) notFound();
  const grant = await currentCaseGrant(slug);
  if (!grant) return <main id="main" className="mx-auto max-w-lg px-6 py-24"><h1 className="font-heading text-3xl">Private case study</h1><p className="mt-4">Enter the invitation code shared with you.</p><InvitationForm slug={slug} /></main>;
  const study = await db.privateCaseStudy.findUnique({ where: { slug } });
  if (!study) notFound();
  const images = Array.isArray(study.images) ? study.images as { file: string; alt: string }[] : [];
  return <main id="main" className="mx-auto max-w-5xl space-y-8 px-6 py-20"><h1 className="font-heading text-4xl">{study.title}</h1><p>{study.summary}</p><p className="text-sm text-muted">Shared privately for review. Please respect the creator’s ownership.</p>
    {images.filter(image => CASE_FILE.test(image.file)).map(image => <figure key={image.file}>
      {/* Authenticated media must bypass the public Next image optimizer/cache. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/private/${slug}/${image.file}`} alt={image.alt} draggable={false} className="h-auto w-full rounded-xl" />
    </figure>)}
    <form action={leaveCase}><button className="rounded-xl border border-line px-5 py-3">Close private view</button></form>
  </main>;
}

import { get } from "@vercel/blob";
import { CASE_FILE, CASE_SLUG, currentCaseGrant, PRIVATE_HEADERS } from "@/server/portfolio/access";
import { db } from "@/server/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; file: string }> }) {
  const { slug, file } = await params;
  const deny = () => new Response(null, { status: 404, headers: PRIVATE_HEADERS });
  if (!CASE_SLUG.test(slug) || slug.length > 60 || !CASE_FILE.test(file)) return deny();
  if (!await currentCaseGrant(slug)) return deny();
  const study = await db.privateCaseStudy.findUnique({ where: { slug }, select: { images: true } });
  if (!study || !Array.isArray(study.images) || !study.images.some(image => image && typeof image === "object" && "file" in image && image.file === file)) return deny();
  const image = await get(`portfolio-private/${slug}/${file}`, { access: "private", useCache: false }).catch(() => null);
  if (!image) return deny();
  return new Response(image.stream, { headers: { ...PRIVATE_HEADERS, "Content-Type": "image/webp", "Content-Security-Policy": "default-src 'none'; sandbox" } });
}

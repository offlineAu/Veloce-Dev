import "server-only";
import { db } from "@/server/db";
import { defaultServices, type ServiceItem } from "@/content/site";

/** Active services from the database, falling back to the content defaults when none are configured. */
export async function getServices(): Promise<ServiceItem[]> {
  try {
    const rows = await db.service.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } });
    if (rows.length > 0) {
      return rows.map((r) => ({
        slug: r.slug,
        title: r.title,
        description: r.description,
        benefit: r.benefit ?? "",
        icon: r.icon ?? "layers",
      }));
    }
  } catch {
    /* DB unavailable: fall back so the public page still renders */
  }
  return defaultServices;
}

import { z } from "zod";
import { PACKAGE_FORMAT, type TemplatePackage, type TreeNode } from "../template-package";

const attr = z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.string())]);

const element: z.ZodType<{ t: string; a?: Record<string, unknown>; c?: TreeNode[]; b?: Record<string, string> }> = z.lazy(() =>
  z.object({
    t: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/),
    a: z.record(z.string().regex(/^[a-zA-Z][\w:-]*$/), attr).optional(),
    c: z.array(node).optional(),
    b: z.record(z.string(), z.string()).optional(),
  }),
);
const node: z.ZodType<TreeNode> = z.lazy(() =>
  z.union([z.string(), z.object({ f: z.string() }), z.object({ r: z.string(), item: element }), element]),
) as z.ZodType<TreeNode>;

const field = z.object({ id: z.string().regex(/^[a-z]\d+$/), kind: z.enum(["text", "textarea", "image", "link"]), label: z.string().max(80) });
const values = z.record(z.string(), z.string());

/** What a template package must look like before it is written (and what tests check the importer against). */
export const templatePackageSchema = z.object({
  format: z.literal(PACKAGE_FORMAT),
  slug: z.string().regex(/^[a-z0-9-]{1,40}$/),
  version: z.number().int().positive(),
  name: z.string().min(1).max(60),
  description: z.string().max(300),
  websiteType: z.string(),
  theme: z.record(z.string(), z.unknown()),
  pages: z
    .array(
      z.object({
        key: z.string().regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/),
        title: z.string().max(60),
        frame: z.string(),
        sections: z.array(
          z.object({
            id: z.string().regex(/^[a-z0-9-]{1,80}$/),
            label: z.string().max(60),
            tree: element,
            fields: z.array(field),
            defaults: values,
            repeaters: z.array(z.object({ id: z.string(), label: z.string(), itemLabel: z.string(), fields: z.array(field), defaults: z.array(values), max: z.number() })),
          }),
        ).min(1),
      }),
    )
    .min(1),
  notes: z.string().optional(),
  importedAt: z.string(),
});

export const validatePackage = (pkg: TemplatePackage) => templatePackageSchema.safeParse(pkg);

import type { ComponentConfig, Field, Fields } from "@puckeditor/core";
import { findSection, type FieldDef, type TemplateSection } from "@/lib/builder/template-package";
import { linkField } from "../links";
import { renderNode } from "../node-tree";
import type { LoadedTemplate } from "../template-registry";

/**
 * One section of an imported designer template. The layout comes from the template package; the block only stores
 * what the visitor changed: text, image addresses and links (`values`), and the entries of repeating lists
 * (`items`, e.g. portfolio cards). The panel's fields are built from the section's own field list.
 */
export type DesignSectionProps = {
  sectionId: string;
  values: Record<string, string>;
  items: Record<string, Record<string, string>[]>;
};

type Meta = { template?: LoadedTemplate };

function fieldFor(def: FieldDef): Field {
  switch (def.kind) {
    case "textarea":
      return { type: "textarea", label: def.label };
    case "image":
      return { type: "text", label: def.label, placeholder: "https://…" };
    case "link":
      return linkField(def.label) as Field;
    default:
      return { type: "text", label: def.label };
  }
}

const objectOf = (defs: FieldDef[]) => Object.fromEntries(defs.map((d) => [d.id, fieldFor(d)]));

function fieldsFor(section: TemplateSection): Fields<DesignSectionProps> {
  const fields: Record<string, Field> = {};
  if (section.fields.length) fields.values = { type: "object", label: "Content", objectFields: objectOf(section.fields) };
  if (section.repeaters.length) {
    fields.items = {
      type: "object",
      label: "Lists",
      objectFields: Object.fromEntries(
        section.repeaters.map((r) => [
          r.id,
          {
            type: "array",
            label: r.label,
            max: r.max,
            arrayFields: objectOf(r.fields),
            defaultItemProps: r.defaults[0] ?? {},
            getItemSummary: (_item: unknown, i?: number) => `${r.itemLabel} ${(i ?? 0) + 1}`,
          } as Field,
        ]),
      ),
    };
  }
  return fields as Fields<DesignSectionProps>;
}

export const DesignSection: ComponentConfig<DesignSectionProps> = {
  label: "Design section",
  fields: {} as Fields<DesignSectionProps>,
  defaultProps: { sectionId: "", values: {}, items: {} },
  resolveFields: (data, { metadata }) => {
    const section = findSection((metadata as Meta).template?.pkg, data.props.sectionId);
    return section ? fieldsFor(section) : ({} as Fields<DesignSectionProps>);
  },
  render: ({ sectionId, values, items, puck }) => {
    const template = (puck.metadata as Meta).template;
    if (!template) {
      return <div className="grid min-h-32 place-items-center text-sm text-(--site-muted)">Loading the design…</div>;
    }
    const section = findSection(template.pkg, sectionId);
    if (!section) {
      return <div className="grid min-h-24 place-items-center text-sm text-(--site-muted)">This section is no longer part of the template.</div>;
    }
    // Fields added to the template after this section was placed fall back to the template's own content.
    const ctx = { values: { ...section.defaults, ...values }, items: { ...Object.fromEntries(section.repeaters.map((r) => [r.id, r.defaults])), ...items }, puck };
    return <>{renderNode(section.tree, ctx)}</>;
  },
};

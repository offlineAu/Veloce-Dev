import { allThemesCss, themeInitScript } from "@/lib/themes";

/**
 * Puts every palette in the document (default on :root, others under [data-theme]) and, before first paint, applies
 * the visitor's saved choice. Rendered inline so there is no flash and portalled UI (dialogs, sheets) is themed too.
 */
export function ThemeScope() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: allThemesCss() }} />
      <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
    </>
  );
}

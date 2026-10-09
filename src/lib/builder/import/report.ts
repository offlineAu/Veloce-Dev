/** What the importer noticed, written to import-report.md for the team's review. */
export class Report {
  private readonly warnings = new Map<string, number>();
  private readonly counts = new Map<string, number>();
  readonly notes: string[] = [];

  /** Something the reviewer should look at. Repeated messages are counted, not repeated. */
  warn(message: string) {
    this.warnings.set(message, (this.warnings.get(message) ?? 0) + 1);
  }

  count(what: string, n = 1) {
    this.counts.set(what, (this.counts.get(what) ?? 0) + n);
  }

  note(message: string) {
    this.notes.push(message);
  }

  get warningCount() {
    return this.warnings.size;
  }

  toMarkdown(title: string): string {
    const lines = [`# Import report: ${title}`, ""];
    if (this.notes.length) lines.push("## Summary", "", ...this.notes.map((n) => `- ${n}`), "");
    lines.push("## Needs review", "");
    if (this.warnings.size === 0) lines.push("- Nothing flagged.");
    for (const [m, n] of this.warnings) lines.push(`- ${m}${n > 1 ? ` (×${n})` : ""}`);
    lines.push("", "## Removed or changed during import", "");
    if (this.counts.size === 0) lines.push("- Nothing.");
    for (const [m, n] of this.counts) lines.push(`- ${m}: ${n}`);
    lines.push("");
    return lines.join("\n");
  }
}

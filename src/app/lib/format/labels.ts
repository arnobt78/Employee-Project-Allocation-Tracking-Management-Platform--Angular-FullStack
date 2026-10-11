/**
 * `in_review` / `in review` / `IN-REVIEW` → `In Review`; empty input → `''`.
 * Mixed-case words keep their inner capitals so acronyms like `AI` survive.
 */
export function titleCaseLabel(value: string | null | undefined): string {
  const words = (value ?? '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const normalized = words === words.toUpperCase() ? words.toLowerCase() : words;
  return normalized.replace(/(^|\s)(\S)/g, (_, space: string, char: string) => space + char.toUpperCase());
}

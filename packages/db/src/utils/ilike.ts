/** Escape `%`, `_`, and `\` for PostgREST `ilike` patterns. */
export function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

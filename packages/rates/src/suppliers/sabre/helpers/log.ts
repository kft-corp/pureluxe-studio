/** Structured Sabre logs (rates package has no shared logger yet). */
type SabreLogMeta = Record<string, unknown>;

export const sabreLog = {
  error(message: string, meta?: SabreLogMeta): void {
    if (meta && Object.keys(meta).length > 0) {
      console.error(`[sabre] ${message}`, meta);
      return;
    }
    console.error(`[sabre] ${message}`);
  },
  warn(message: string, meta?: SabreLogMeta): void {
    if (meta && Object.keys(meta).length > 0) {
      console.warn(`[sabre] ${message}`, meta);
      return;
    }
    console.warn(`[sabre] ${message}`);
  },
};

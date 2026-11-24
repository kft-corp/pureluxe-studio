/**
 * Shared helpers for directory list URL state (filters / search / page).
 * Query string is the source of truth so list → detail → back keeps filters.
 */

export function toURLSearchParams(
  raw: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== "") params.append(key, item);
      }
      continue;
    }
    if (value !== "") params.set(key, value);
  }
  return params;
}

export function readStringParam(
  params: URLSearchParams,
  key: string,
  fallback = "",
): string {
  return params.get(key)?.trim() ?? fallback;
}

export function readPageParam(params: URLSearchParams): number {
  const raw = params.get("page");
  if (raw == null || raw === "") return 1;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

export function readBoolParam(params: URLSearchParams, key: string): boolean {
  const raw = params.get(key);
  return raw === "1" || raw === "true";
}

export function readCsvParam(params: URLSearchParams, key: string): string[] {
  const values: string[] = [];
  for (const entry of params.getAll(key)) {
    for (const part of entry.split(",")) {
      const trimmed = part.trim();
      if (trimmed) values.push(trimmed);
    }
  }
  return [...new Set(values)];
}

export function setStringParam(
  params: URLSearchParams,
  key: string,
  value: string,
  defaultValue = "",
) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === defaultValue) return;
  params.set(key, trimmed);
}

export function setPageParam(params: URLSearchParams, page: number) {
  if (page <= 1) return;
  params.set("page", String(page));
}

export function setBoolParam(
  params: URLSearchParams,
  key: string,
  value: boolean,
) {
  if (!value) return;
  params.set(key, "1");
}

export function setCsvParam(
  params: URLSearchParams,
  key: string,
  values: string[],
) {
  if (values.length === 0) return;
  params.set(key, values.join(","));
}

/** Keep only values that appear in `allowed`. */
export function filterAllowed<T extends string>(
  values: string[],
  allowed: readonly T[],
): T[] {
  const set = new Set<string>(allowed);
  return values.filter((value): value is T => set.has(value));
}

/** Read a query value that must be one of `allowed`; otherwise `fallback`. */
export function readEnumParam<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = params.get(key)?.trim();
  if (raw && (allowed as readonly string[]).includes(raw)) {
    return raw as T;
  }
  return fallback;
}

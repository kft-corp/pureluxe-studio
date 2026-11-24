/** Last filtered list URL per directory path — used by detail “back to list” links. */

function storageKey(listPath: string): string {
  return `studio:directory-return:${listPath}`;
}

export function rememberDirectoryReturn(listPath: string, href: string) {
  try {
    window.sessionStorage.setItem(storageKey(listPath), href);
  } catch {
    // Private mode / quota — ignore.
  }
}

export function readDirectoryReturn(
  listPath: string,
  fallback: string,
): string {
  try {
    return window.sessionStorage.getItem(storageKey(listPath)) || fallback;
  } catch {
    return fallback;
  }
}

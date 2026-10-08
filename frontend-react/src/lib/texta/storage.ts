export const TOKEN_KEY = "texta_auth_token";
export function readStorage(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writeStorage(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    window.dispatchEvent(new Event("texta:preferences"));
    return true;
  } catch {
    return false;
  }
}
export function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(readStorage(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export function subscribePreferences(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("texta:preferences", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("texta:preferences", listener);
  };
}

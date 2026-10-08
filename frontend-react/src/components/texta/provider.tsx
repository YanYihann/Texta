"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { api, ApiError, errorMessage } from "@/lib/texta/api";
import { LibraryStore } from "@/lib/texta/library";
import {
  readStorage,
  subscribePreferences,
  TOKEN_KEY,
  writeStorage,
} from "@/lib/texta/storage";
import type { Usage, User } from "@/lib/texta/types";
import { dictionary } from "@/lib/texta/translations";

interface Session {
  user: User | null;
  ready: boolean;
  error: string;
  library: LibraryStore | null;
  usage: Usage | null;
  retry: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  logout: () => Promise<void>;
}
const SessionContext = createContext<Session | null>(null);
export function TextaProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [library, setLibrary] = useState<LibraryStore | null>(null),
    [usage, setUsage] = useState<Usage | null>(null);
  const activeStore = useRef<LibraryStore | null>(null),
    attempt = useRef(0);
  const refreshUsage = useCallback(async () => {
    const token = readStorage(TOKEN_KEY);
    if (!token) return;
    try {
      const result = await api<{ usage: Usage; user: User }>("/api/usage", {
        token,
      });
      if (token !== readStorage(TOKEN_KEY)) return;
      setUsage(result.usage);
      setUser(result.user);
    } catch {
      /* Preserve the account during transient outages. */
    }
  }, []);
  const retry = useCallback(async () => {
    const serial = ++attempt.current,
      token = readStorage(TOKEN_KEY);
    setReady(false);
    setError("");
    if (!token) {
      activeStore.current?.dispose();
      activeStore.current = null;
      setLibrary(null);
      setUser(null);
      setUsage(null);
      setReady(true);
      return;
    }
    try {
      const result = await api<{ user: User }>("/api/auth/me", {
        token,
        retries: 1,
      });
      if (serial !== attempt.current || token !== readStorage(TOKEN_KEY))
        return;
      if (!result.user?.id)
        throw new ApiError("账号信息不完整，请重新登录。", 401);
      setUser(result.user);
      if (
        activeStore.current?.userId !== result.user.id ||
        !activeStore.current?.hasToken(token)
      ) {
        activeStore.current?.dispose();
        const next = new LibraryStore(result.user.id, token);
        activeStore.current = next;
        setLibrary(next);
        void next.refresh();
      }
      setReady(true);
      void refreshUsage();
    } catch (error) {
      if (serial !== attempt.current || token !== readStorage(TOKEN_KEY))
        return;
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        activeStore.current?.dispose();
        activeStore.current = null;
        writeStorage(TOKEN_KEY, null);
        setLibrary(null);
        setUser(null);
        setUsage(null);
      } else setError(errorMessage(error));
      setReady(true);
    }
  }, [refreshUsage]);
  useEffect(() => {
    // Browser-only credentials require a mount-time account request, with an explicit connecting state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void retry();
    const changed = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY) void retry();
    };
    const visibility = () => {
      if (document.visibilityState === "visible") void refreshUsage();
    };
    window.addEventListener("storage", changed);
    document.addEventListener("visibilitychange", visibility);
    // Invalidate the latest in-flight request; this ref is a counter, not a DOM node.
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      attempt.current++;
      activeStore.current?.dispose();
      activeStore.current = null;
      window.removeEventListener("storage", changed);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [retry, refreshUsage]);
  const logout = useCallback(async () => {
    const token = readStorage(TOKEN_KEY);
    await activeStore.current?.flush();
    try {
      await api("/api/auth/logout", { method: "POST", token: token || "" });
    } catch {
      /* Local sign-out works offline. */
    }
    if (readStorage(TOKEN_KEY) !== token) return;
    writeStorage(TOKEN_KEY, null);
    activeStore.current?.dispose();
    activeStore.current = null;
    setUser(null);
    setLibrary(null);
    setUsage(null);
    // A full navigation discards all account-scoped component memory after sign-out.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    location.assign("/");
  }, []);
  const value = useMemo(
    () => ({ user, ready, error, library, usage, retry, refreshUsage, logout }),
    [user, ready, error, library, usage, retry, refreshUsage, logout],
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw Error("Missing TextaProvider");
  return context;
}
export function usePreference(key: string, fallback: string) {
  const get = useCallback(() => readStorage(key) || fallback, [key, fallback]);
  const value = useSyncExternalStore(subscribePreferences, get, () => fallback);
  const set = useCallback(
    (next: string) => {
      writeStorage(key, next);
    },
    [key],
  );
  return [value, set] as const;
}
export function useText() {
  const [language, setLanguage] = usePreference("texta_language", "zh");
  const t = useCallback(
    (text: string) => (language === "en" ? dictionary[text] || text : text),
    [language],
  );
  return { t, language, setLanguage };
}
export function PageFrame({
  children,
  kind = "workspace",
  title,
}: {
  children: React.ReactNode;
  kind?: string;
  title: string;
}) {
  const [theme] = usePreference("texta_theme_preference", "light");
  const { language, t, setLanguage } = useText();
  useEffect(() => {
    if (kind !== "legal") return;
    const requested = new URLSearchParams(location.search).get("lang");
    if (requested === "zh" || requested === "en") setLanguage(requested);
  }, [kind, setLanguage]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    document.body.classList.add(`${kind}-page`);
    document.documentElement.lang = language === "en" ? "en" : "zh-CN";
    document.title = `Texta · ${t(title)}`;
    document.documentElement.dataset.legalLanguage = language;
    return () => document.body.classList.remove(`${kind}-page`);
  }, [kind, language, t, title]);
  return <>{children}</>;
}

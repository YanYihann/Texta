import type {
  Article,
  Folder,
  Library,
  LexiconEntry,
  NotebookEntry,
  WordPreference,
} from "./types";
import { readJson, readStorage, writeStorage, TOKEN_KEY } from "./storage";
import { api, ApiError, errorMessage } from "./api";

// Keep the incumbent API/browser identifiers, including phrases and apostrophes.
export const wordKey = (word: string) =>
  word
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
export const id = () => crypto.randomUUID();
export const emptyLibrary = (): Library => ({
  favorites: [],
  notebookEntries: [],
  vocabPrefs: {},
  libraryFolders: [],
});
const iso = (value: unknown, fallback: string) =>
  typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : fallback;
export function normalizeArticle(raw: Partial<Article>): Article {
  const now = new Date().toISOString();
  return {
    ...raw,
    id: raw.id || id(),
    title: raw.title || "未命名文章",
    words: raw.words || [],
    article: raw.article || "",
    lexicon: raw.lexicon || [],
    baseLexicon: raw.baseLexicon || [],
    paragraphsEn: raw.paragraphsEn || [],
    paragraphsZh: raw.paragraphsZh || [],
    alignment: raw.alignment || [],
    sentencePairs: raw.sentencePairs || [],
    contextGlosses: raw.contextGlosses || [],
    runs: raw.runs || [],
    generationMode: raw.generationMode === "mixed" ? "mixed" : "standard",
    generationQuality: "normal",
    missing: raw.missing || [],
    savedAt: raw.savedAt || now,
    createdAt: iso(raw.createdAt || raw.savedAt, now),
    updatedAt: iso(raw.updatedAt || raw.createdAt || raw.savedAt, now),
    deletedAt: raw.deletedAt || "",
    folderId: raw.folderId || "",
  };
}
function normalizeNotebook(
  raw: Partial<NotebookEntry> & { wordKey?: string },
): NotebookEntry | null {
  const key = wordKey(raw.key || raw.wordKey || raw.word || "");
  if (!key) return null;
  const now = new Date().toISOString();
  return {
    ...raw,
    id: raw.id || id(),
    key,
    word: raw.word || key,
    senses: raw.senses || [],
    createdAt: iso(raw.createdAt || raw.updatedAt, now),
    updatedAt: iso(raw.updatedAt || raw.createdAt, now),
    deletedAt: raw.deletedAt || "",
    sourceArticle: raw.sourceArticle?.article
      ? normalizeArticle(raw.sourceArticle)
      : null,
  };
}
function mergeRows<T extends { updatedAt: string }>(
  remote: T[],
  local: T[],
  key: (row: T) => string,
): T[] {
  const rows = new Map<string, T>();
  for (const row of [...remote, ...local]) {
    const old = rows.get(key(row));
    if (!old || row.updatedAt >= old.updatedAt) rows.set(key(row), row);
  }
  return [...rows.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}
export function normalizeLibrary(raw: Partial<Library>): Library {
  const now = new Date().toISOString();
  const favorites = (Array.isArray(raw.favorites) ? raw.favorites : []).map(
    normalizeArticle,
  );
  const notebookEntries = (
    Array.isArray(raw.notebookEntries) ? raw.notebookEntries : []
  )
    .map(normalizeNotebook)
    .filter((row): row is NotebookEntry => Boolean(row));
  const libraryFolders = (
    Array.isArray(raw.libraryFolders) ? raw.libraryFolders : []
  )
    .filter((row) => row.id && row.name)
    .map((row) => ({
      ...row,
      createdAt: iso(row.createdAt, now),
      updatedAt: iso(row.updatedAt || row.createdAt, now),
      deletedAt: row.deletedAt || "",
    }));
  const vocabPrefs: Record<string, WordPreference> = {};
  for (const [key, row] of Object.entries(raw.vocabPrefs || {}))
    vocabPrefs[wordKey(key)] = {
      ...row,
      mastery: row.mastery === "mastered" ? "mastered" : "unknown",
      createdAt: iso(row.createdAt || row.updatedAt, now),
      updatedAt: iso(row.updatedAt || row.createdAt, now),
    };
  return { favorites, notebookEntries, libraryFolders, vocabPrefs };
}
export function mergeLibrary(
  local: Partial<Library>,
  remote: Partial<Library>,
): Library {
  const a = normalizeLibrary(local),
    b = normalizeLibrary(remote);
  const vocabPrefs = { ...b.vocabPrefs };
  for (const [key, row] of Object.entries(a.vocabPrefs))
    if (!vocabPrefs[key] || row.updatedAt >= vocabPrefs[key].updatedAt)
      vocabPrefs[key] = row;
  return {
    favorites: mergeRows(b.favorites, a.favorites, (row) => row.id),
    notebookEntries: mergeRows(
      b.notebookEntries,
      a.notebookEntries,
      (row) => row.key,
    ),
    libraryFolders: mergeRows(
      b.libraryFolders,
      a.libraryFolders,
      (row) => row.id,
    ),
    vocabPrefs,
  };
}

export interface LibrarySnapshot {
  library: Library;
  status: "loading" | "saved" | "syncing" | "offline";
  message: string;
  revision: number;
}
const EMPTY_SNAPSHOT: LibrarySnapshot = {
  library: emptyLibrary(),
  status: "loading",
  message: "",
  revision: 0,
};
export class LibraryStore {
  private snapshot: LibrarySnapshot = EMPTY_SNAPSHOT;
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setTimeout>;
  private pending: Promise<void> | null = null;
  private hydrating: Promise<void> | null = null;
  private loaded = false;
  private dirty = false;
  private disposed = false;
  private failures = 0;
  readonly storageKey: string;
  constructor(
    readonly userId: string,
    private token: string,
  ) {
    this.storageKey = `texta_next_library_v1_${userId}`;
    let local = readJson<Partial<Library>>(this.storageKey, {});
    // Import the incumbent browser's data once, bind it to the successfully authenticated account,
    // and retain the old keys untouched so rollback is possible.
    const ownerKey = "texta_next_legacy_owner";
    const owner = readStorage(ownerKey);
    if ((!owner || owner === userId) && !readStorage(this.storageKey)) {
      const legacy = {
        favorites: readJson<Article[]>("texta_favorites_v1", []),
        notebookEntries: readJson<NotebookEntry[]>("texta_notebook_v1", []),
        vocabPrefs: readJson<Record<string, WordPreference>>(
          "texta_vocab_prefs_v1",
          {},
        ),
        libraryFolders: readJson<Folder[]>("texta_library_folders", []),
      };
      local = mergeLibrary(local, legacy);
      writeStorage(ownerKey, userId);
    }
    const saved = normalizeLibrary(local);
    this.snapshot = {
      library: saved,
      status: "loading",
      message: "正在同步学习库…",
      revision: 0,
    };
    this.persist();
    window.addEventListener("online", this.online);
    window.addEventListener("pagehide", this.persist);
    window.addEventListener("storage", this.storageChanged);
  }
  getSnapshot = () => this.snapshot;
  hasToken = (token: string) => token === this.token;
  getServerSnapshot = () => EMPTY_SNAPSHOT;
  subscribe = (callback: () => void) => {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  };
  private valid = () => !this.disposed && readStorage(TOKEN_KEY) === this.token;
  private emit(patch: Partial<LibrarySnapshot>) {
    if (!this.valid()) return;
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private persist = () => {
    if (!writeStorage(this.storageKey, JSON.stringify(this.snapshot.library))) {
      this.emit({ message: "浏览器存储空间不足，请尽快导出或同步学习资料。" });
    }
  };
  private online = () => {
    void this.refresh();
  };
  private storageChanged = (event: StorageEvent) => {
    if (event.key !== this.storageKey || !event.newValue || !this.valid())
      return;
    try {
      this.change((current) =>
        mergeLibrary(current, JSON.parse(event.newValue!)),
      );
    } catch {
      /* Keep the current library. */
    }
  };
  async refresh() {
    if (this.hydrating) return this.hydrating;
    this.hydrating = this.readRemote();
    try {
      await this.hydrating;
    } finally {
      this.hydrating = null;
    }
  }
  private async readRemote() {
    if (!this.valid()) return;
    try {
      const remote = await api<Library>("/api/library", {
        token: this.token,
        retries: 1,
      });
      if (!this.valid()) return;
      const merged = mergeLibrary(this.snapshot.library, remote);
      this.loaded = true;
      this.dirty =
        JSON.stringify(merged) !== JSON.stringify(normalizeLibrary(remote));
      this.emit({
        library: merged,
        status: "saved",
        message: "",
        revision: this.snapshot.revision + 1,
      });
      this.persist();
      if (this.dirty) await this.flush();
    } catch (error) {
      this.emit({ status: "offline", message: errorMessage(error) });
    }
  }
  change(update: (current: Library) => Library) {
    if (!this.valid()) return;
    this.emit({
      library: update(this.snapshot.library),
      revision: this.snapshot.revision + 1,
    });
    this.dirty = true;
    this.persist();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, 800);
  }
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.pending) return this.pending;
    if (!this.valid() || !this.dirty) return;
    // Never upload a partial local snapshot before the remote library has been fetched.
    if (!this.loaded) return this.refresh();
    this.pending = this.send();
    try {
      await this.pending;
    } finally {
      this.pending = null;
    }
  }
  private async send() {
    while (this.valid() && this.dirty) {
      const revision = this.snapshot.revision;
      const library = this.snapshot.library;
      this.emit({ status: "syncing" });
      try {
        await api("/api/library/sync", {
          token: this.token,
          method: "POST",
          body: library,
        });
        if (!this.valid()) return;
        this.dirty = this.snapshot.revision !== revision;
        this.failures = 0;
        this.emit({ status: "saved", message: "" });
      } catch (error) {
        this.emit({ status: "offline", message: errorMessage(error) });
        if (!(error instanceof ApiError && [401, 403].includes(error.status))) {
          this.failures++;
          clearTimeout(this.timer);
          this.timer = setTimeout(
            () => {
              void this.flush();
            },
            Math.min(60000, 2500 * 2 ** Math.min(this.failures, 5)),
          );
        }
        return;
      }
    }
  }
  dispose() {
    this.persist();
    this.disposed = true;
    clearTimeout(this.timer);
    window.removeEventListener("online", this.online);
    window.removeEventListener("pagehide", this.persist);
    window.removeEventListener("storage", this.storageChanged);
  }
}

export function addNotebook(
  library: Library,
  entries: LexiconEntry[],
  source?: Article,
): Library {
  const now = new Date().toISOString(),
    rows = new Map(library.notebookEntries.map((row) => [row.key, row]));
  for (const entry of entries) {
    const key = wordKey(entry.word),
      old = rows.get(key);
    rows.set(key, {
      ...old,
      ...entry,
      id: old?.id || id(),
      key,
      createdAt: old?.createdAt || now,
      updatedAt: now,
      deletedAt: "",
      sourceArticle: old?.sourceArticle || source || null,
    });
  }
  return { ...library, notebookEntries: [...rows.values()] };
}

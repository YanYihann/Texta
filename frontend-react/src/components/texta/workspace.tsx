"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { api, ApiError, errorMessage } from "@/lib/texta/api";
import {
  addNotebook,
  normalizeArticle,
  wordKey,
  type LibraryStore,
} from "@/lib/texta/library";
import { articleContext, hydrateLexicon } from "@/lib/texta/reading";
import {
  readJson,
  readStorage,
  TOKEN_KEY,
  writeStorage,
} from "@/lib/texta/storage";
import { splitWords } from "@/lib/texta/words";
import { sample } from "@/lib/texta/sample";
import type {
  Article,
  LexiconEntry,
  Mastery,
  NotebookEntry,
  User,
  WechatConnection,
} from "@/lib/texta/types";
import { PageFrame, usePreference, useSession, useText } from "./provider";
import { Footer, LanguageButton, Loading, Modal } from "./shared";
import { ArticleReader, type SelectWord } from "./article-reader";
import { DefinitionCard } from "./definition-card";
import { LibraryView } from "./library-view";
import { NotebookView } from "./notebook-view";
import { WordComposer, type Draft } from "./word-composer";
const ExportDialog = dynamic(() =>
  import("./export-dialog").then((module) => module.ExportDialog),
);
const themes = {
  light: "森林",
  dark: "深色",
  highlighter: "荧光",
  paper: "纸张",
  ocean: "海洋",
  lavender: "薰衣草",
  system: "跟随系统",
};
type Tab = "article" | "favorites" | "notebook" | "history";
export function Workspace() {
  const session = useSession(),
    router = useRouter();
  useEffect(() => {
    if (session.ready && !session.error && !session.user) router.replace("/");
  }, [session.ready, session.error, session.user, router]);
  return (
    <PageFrame title="词汇学习">
      {!session.ready || session.error || !session.user || !session.library ? (
        <Loading error={session.error} retry={session.retry} />
      ) : (
        <LearningWorkspace
          key={session.user.id}
          user={session.user}
          store={session.library}
        />
      )}
    </PageFrame>
  );
}
function LearningWorkspace({
  user,
  store,
}: {
  user: User;
  store: LibraryStore;
}) {
  const { t } = useText(),
    session = useSession(),
    snapshot = useSyncExternalStore(
      store.subscribe,
      store.getSnapshot,
      store.getServerSnapshot,
    ),
    { library } = snapshot;
  const [theme, setTheme] = usePreference("texta_theme_preference", "light"),
    [fontSize, setFontSize] = usePreference("texta_font_size", "medium");
  const [draft, setDraft] = useState<Draft>(() => {
    const old = readJson<Partial<Draft> & { quick?: boolean }>(
      `texta_draft_${user.id}`,
      {},
    );
    return {
      words: typeof old.words === "string" ? old.words : "",
      pending: typeof old.pending === "string" ? old.pending : "",
      mode: old.mode === "standard" ? "standard" : "mixed",
      short: Boolean(old.short ?? old.quick),
    };
  });
  const historyKey = `texta_next_history_${user.id}`;
  const [history, setHistory] = useState<Article[]>(() => {
    const stored = readJson<Partial<Article>[]>(
      historyKey,
      readStorage("texta_next_legacy_owner") === user.id
        ? readJson<Partial<Article>[]>("texta_history_v1", [])
        : [],
    );
    return Array.isArray(stored)
      ? stored
          .filter((row) => row && typeof row === "object")
          .map(normalizeArticle)
          .slice(0, 80)
      : [];
  });
  const [tab, setTab] = useState<Tab>("article"),
    [article, setArticle] = useState<Article | null>(null),
    [active, setActive] = useState(""),
    [context, setContext] = useState<{ en: string; zh: string } | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [hydrationError, setHydrationError] = useState("");
  const [editor, setEditor] = useState(true),
    [reading, setReading] = useState(false),
    [focusDefinition, setFocusDefinition] = useState(false),
    [showChinese, setShowChinese] = useState(true),
    [mobile, setMobile] = useState("input");
  const [guide, setGuide] = useState(
      () =>
        !readStorage(`texta_guide_seen_${user.id}`) ||
        readStorage("texta_guide_force_open") === "1",
    ),
    [guideDismiss, setGuideDismiss] = useState(true);
  const [exporting, setExporting] = useState<{
    source: { article?: Article; entries?: NotebookEntry[] };
    format: "pdf" | "word";
  } | null>(null);
  const [wechat, setWechat] = useState<WechatConnection | null>(null),
    [wechatError, setWechatError] = useState(""),
    [wechatBusy, setWechatBusy] = useState(false),
    [logoutBusy, setLogoutBusy] = useState(false);
  const openSerial = useRef(0),
    generating = useRef(false),
    alive = useRef(true),
    wechatSerial = useRef(0),
    menu = useRef<HTMLDetailsElement>(null);
  // These are request counters: cleanup invalidates their current values.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      openSerial.current++;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      wechatSerial.current++;
    };
  }, []);
  useEffect(() => {
    writeStorage(historyKey, JSON.stringify(history));
  }, [historyKey, history]);
  useEffect(() => {
    document.body.dataset.workspaceView = tab;
    document.body.classList.toggle("reading-mode", reading);
    document.body.classList.toggle("focus-definition-open", focusDefinition);
    document.documentElement.style.setProperty(
      "--reading-panel-height",
      editor ? "min(72vh, 800px)" : "calc(100dvh - 155px)",
    );
    return () => {
      document.body.classList.remove("reading-mode", "focus-definition-open");
      delete document.body.dataset.workspaceView;
    };
  }, [tab, reading, focusDefinition, editor]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
        setReading(false);
        setFocusDefinition(false);
        if (menu.current?.open) {
          menu.current.open = false;
          menu.current.querySelector("summary")?.focus();
        }
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  const refreshWechat = useCallback(async () => {
    const serial = ++wechatSerial.current,
      token = readStorage(TOKEN_KEY);
    setWechatBusy(true);
    setWechatError("");
    try {
      const result = await api<WechatConnection>(
        "/api/auth/wechat/connection",
        { token: token || "" },
      );
      if (
        alive.current &&
        serial === wechatSerial.current &&
        token === readStorage(TOKEN_KEY)
      )
        setWechat(result);
    } catch (error) {
      if (alive.current && serial === wechatSerial.current)
        setWechatError(errorMessage(error));
    } finally {
      if (alive.current && serial === wechatSerial.current)
        setWechatBusy(false);
    }
  }, []);
  // Query the external account connection on mount, preserving its loading/unknown states.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshWechat();
  }, [refreshWechat]);
  function updateDraft(next: Draft) {
    setDraft(next);
    if (
      !writeStorage(
        `texta_draft_${user.id}`,
        JSON.stringify({ ...next, quality: "normal" }),
      )
    )
      setMessage("浏览器存储空间不足，请尽快导出或同步学习资料。");
  }
  const selectWord: SelectWord = (word, paragraph, sentence) => {
    if (!article) return;
    setActive(wordKey(word));
    setContext(articleContext(article, word, paragraph, sentence));
    setMobile("word");
    if (reading) setFocusDefinition(true);
  };
  async function hydrate(current: Article, serial: number) {
    const missing = current.words.filter(
      (word) =>
        !current.lexicon.find((entry) => wordKey(entry.word) === wordKey(word))
          ?.detailsReady,
    );
    if (!missing.length) return;
    const token = readStorage(TOKEN_KEY);
    try {
      const result = await api<{ entries: LexiconEntry[] }>(
        "/api/vocab/details",
        {
          method: "POST",
          token: token || "",
          body: { words: missing.slice(0, 120) },
          timeoutMs: 300000,
        },
      );
      if (
        !alive.current ||
        serial !== openSerial.current ||
        token !== readStorage(TOKEN_KEY)
      )
        return;
      const full = hydrateLexicon(current, result.entries);
      setArticle(full);
      setHistory((rows) =>
        rows.map((row) => (row.id === full.id ? full : row)),
      );
      store.change((library) => ({
        ...library,
        favorites: library.favorites.map((row) =>
          row.id === full.id && !row.deletedAt
            ? {
                ...full,
                title: row.title,
                folderId: row.folderId,
                createdAt: row.createdAt,
                savedAt: row.savedAt,
                updatedAt: new Date().toISOString(),
              }
            : row,
        ),
      }));
    } catch (error) {
      if (alive.current && serial === openSerial.current)
        setHydrationError(errorMessage(error));
    }
  }
  function openArticle(next: Article, word?: string) {
    const serial = ++openSerial.current;
    setMessage("");
    setArticle(next);
    setTab("article");
    setEditor(false);
    setActive(wordKey(word || next.lexicon[0]?.word || ""));
    setContext(articleContext(next, word || next.lexicon[0]?.word || ""));
    setMobile("article");
    setHydrationError("");
    void hydrate(next, serial);
  }
  async function generate() {
    if (generating.current) return;
    const words = splitWords([draft.words, draft.pending].join(","));
    if (!words.length || words.length > 120) {
      setMessage("一次请输入 1–120 个单词或短语。");
      return;
    }
    const token = readStorage(TOKEN_KEY);
    generating.current = true;
    setBusy(true);
    setMessage("");
    updateDraft({ ...draft, words: words.join(", "), pending: "" });
    try {
      const result = await api<Partial<Article>>("/api/generate", {
        method: "POST",
        token: token || "",
        body: {
          words: words.join(", "),
          shortMode: draft.short,
          generationMode: draft.mode,
          generationQuality: "normal",
        },
        timeoutMs: 300000,
      });
      if (!alive.current || token !== readStorage(TOKEN_KEY)) return;
      const next = normalizeArticle({
        ...result,
        words,
        generationMode: draft.mode,
      });
      if (!next.article) throw Error("生成结果为空，请重试。");
      setHistory((rows) => [next, ...rows].slice(0, 80));
      openArticle(next);
      void session.refreshUsage();
    } catch (error) {
      if (!alive.current || token !== readStorage(TOKEN_KEY)) return;
      setMessage(errorMessage(error));
      if (error instanceof ApiError && error.status === 401)
        void session.retry();
      void session.refreshUsage();
    } finally {
      generating.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function mastery(word: string, value: Mastery) {
    const key = wordKey(word),
      now = new Date().toISOString();
    store.change((current) => ({
      ...current,
      vocabPrefs: {
        ...current.vocabPrefs,
        [key]: {
          ...current.vocabPrefs[key],
          word,
          mastery: value,
          createdAt: current.vocabPrefs[key]?.createdAt || now,
          updatedAt: now,
        },
      },
    }));
  }
  function addUnknown() {
    if (!article) return;
    const entries = article.lexicon.filter(
      (row) => library.vocabPrefs[wordKey(row.word)]?.mastery !== "mastered",
    );
    const newKeys = entries.filter(
      (row) =>
        !library.notebookEntries.some((old) => old.key === wordKey(row.word)),
    );
    if (library.notebookEntries.length + newKeys.length > 2000) {
      setMessage("生词本数量已达到上限，请先删除不需要的词汇。");
      return;
    }
    store.change((current) => addNotebook(current, entries, article));
    setMessage("陌生词已加入生词本。");
  }
  const saved =
    article &&
    library.favorites.find((row) => row.id === article.id && !row.deletedAt);
  function favorite() {
    if (!article) return;
    const now = new Date().toISOString();
    if (
      !saved &&
      library.favorites.length >= 200 &&
      !library.favorites.some((row) => row.id === article.id)
    ) {
      setMessage("收藏数量已达到上限，请先删除不需要的文章。");
      return;
    }
    store.change((current) => {
      const existing = current.favorites.find((row) => row.id === article.id);
      return {
        ...current,
        favorites: existing
          ? current.favorites.map((row) =>
              row.id === article.id
                ? { ...row, deletedAt: saved ? now : "", updatedAt: now }
                : row,
            )
          : [
              ...current.favorites,
              { ...article, savedAt: now, updatedAt: now },
            ],
      };
    });
  }
  const entry = article?.lexicon.find((row) => wordKey(row.word) === active),
    activeIndex =
      article?.lexicon.findIndex((row) => wordKey(row.word) === active) ?? -1;
  function nextWord(delta: number) {
    if (!article?.lexicon.length) return;
    selectWord(
      article.lexicon[
        (activeIndex + delta + article.lexicon.length) % article.lexicon.length
      ].word,
    );
  }
  function closeGuide() {
    if (guideDismiss) writeStorage(`texta_guide_seen_${user.id}`, "1");
    writeStorage("texta_guide_force_open", null);
    setGuide(false);
  }
  function changeTab(next: Tab) {
    setMessage("");
    setTab(next);
    setReading(false);
    setFocusDefinition(false);
    if (next === "article" && !article) setMobile("input");
  }
  return (
    <>
      <a
        className="skip-link"
        href={
          tab === "article"
            ? editor
              ? "#wordInput"
              : "#exportArea"
            : "#study-workspace"
        }
      >
        {t("跳到学习内容")}
      </a>
      <header className="site-header">
        <Link href="/app/" className="wordmark">
          Texta
        </Link>
        <nav className="library-tabs" aria-label={t("学习导航")}>
          {(["article", "favorites", "notebook", "history"] as Tab[]).map(
            (value) => (
              <button
                type="button"
                key={value}
                className={`library-tab ${tab === value ? "active" : ""}`}
                aria-pressed={tab === value}
                onClick={() => changeTab(value)}
              >
                {t(
                  {
                    article: "文章生成",
                    favorites: "收藏夹",
                    notebook: "生词本",
                    history: "历史记录",
                  }[value],
                )}
              </button>
            ),
          )}
        </nav>
        <div className="header-tools">
          <LanguageButton />
          <div className="header-account-actions">
            <Link href="/pay/" className="plans-button">
              {t("Plus / Pro 套餐")}
            </Link>
            <details ref={menu} className="account-menu">
              <summary>{t("账户")}</summary>
              <div className="account-popover">
                <div className="user-row">
                  <span className="user-badge">
                    {user.name || user.email} · {user.plan}
                  </span>
                  <button
                    type="button"
                    disabled={logoutBusy}
                    onClick={async () => {
                      setLogoutBusy(true);
                      await session.logout();
                      setLogoutBusy(false);
                    }}
                  >
                    {t(logoutBusy ? "正在退出…" : "退出登录")}
                  </button>
                </div>
                <div className="usage-card">
                  {t("今日剩余积分")}:{" "}
                  {session.usage?.remaining ??
                    (session.usage?.limit === null ? "∞" : "—")}
                  {user.role === "admin" ? (
                    <>
                      <Link href="/admin/">{t("历史充值审核")}</Link>
                      <Link href="/admin-usage/">{t("用户使用查看")}</Link>
                    </>
                  ) : null}
                </div>
                <section className="wechat-connection">
                  <div className="connection-heading">
                    <span>{t("微信登录")}</span>
                    <span role="status">
                      {t(
                        wechatBusy
                          ? "正在查询…"
                          : wechat?.bound
                            ? "已绑定微信"
                            : wechat
                              ? "未绑定微信"
                              : "暂时无法查询",
                      )}
                    </span>
                  </div>
                  <p className="connection-hint">
                    {t(
                      wechatError ||
                        (wechat?.bound
                          ? wechat.loginAvailable
                            ? "可通过微信登录同一账号。"
                            : "绑定已保留，微信登录暂不可用。"
                          : "在微信小程序「我的 → 账号设置 → 关联已有账号」中完成绑定。"),
                    )}
                  </p>
                  <button
                    type="button"
                    disabled={wechatBusy}
                    onClick={() => void refreshWechat()}
                  >
                    {t("刷新状态")}
                  </button>
                </section>
                <button
                  type="button"
                  onClick={() => {
                    if (menu.current) menu.current.open = false;
                    setGuide(true);
                  }}
                >
                  {t("使用说明")}
                </button>
                <label className="theme-heading">
                  {t("主题样式")}
                  <select
                    aria-label={t("主题样式")}
                    value={theme}
                    onChange={(event) => setTheme(event.target.value)}
                  >
                    {Object.entries(themes).map(([key, label]) => (
                      <option key={key} value={key}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
          </div>
        </div>
      </header>
      <main
        id="study-workspace"
        tabIndex={-1}
        className="app-shell workspace-content"
        data-next-mobile={mobile}
      >
        <div className="sync-state" role="status">
          {t(
            snapshot.message ||
              {
                loading: "正在同步学习库…",
                syncing: "正在同步…",
                saved: "学习库已同步",
                offline: "同步暂不可用，修改已保存在本机。",
              }[snapshot.status],
          )}
          {snapshot.status === "offline" ? (
            <button type="button" onClick={() => void store.refresh()}>
              {t("重试")}
            </button>
          ) : null}
        </div>
        {message ? (
          <p className="warning" role="status">
            {t(message)}
          </p>
        ) : null}
        {tab === "favorites" || tab === "history" ? (
          <LibraryView
            store={store}
            history={history}
            mode={tab}
            onOpen={openArticle}
            onDeleteHistory={(id) =>
              setHistory((rows) => rows.filter((row) => row.id !== id))
            }
          />
        ) : tab === "notebook" ? (
          <NotebookView
            store={store}
            onOpen={openArticle}
            onMastery={mastery}
            onExport={(entries, format) =>
              setExporting({ source: { entries }, format })
            }
          />
        ) : (
          <>
            {editor ? (
              <WordComposer
                draft={draft}
                update={updateDraft}
                generate={() => void generate()}
                preview={() => openArticle(normalizeArticle(sample))}
                busy={busy}
                disabled={session.usage?.remaining === 0}
              />
            ) : (
              <button
                type="button"
                className="edit-words-toolbar"
                onClick={() => {
                  setEditor(true);
                  setMobile("input");
                }}
              >
                {t("修改词汇")}
              </button>
            )}
            {busy ? (
              <p role="status">{t("正在生成文章…请稍候，不要重复提交。")}</p>
            ) : null}
            {article ? (
              <div className="reading-workspace" data-view="article">
                <section className="result-panel" id="resultSection">
                  <div className="result-view" id="articleView">
                    <div className="reading-toolbar">
                      <div className="top-actions">
                        <div className="reading-heading">
                          <h2>{t("文章阅读")}</h2>
                        </div>
                        <div className="actions">
                          <button
                            type="button"
                            onClick={() => setReading(!reading)}
                          >
                            {t(reading ? "退出阅读模式" : "阅读模式")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowChinese(!showChinese)}
                          >
                            {t(showChinese ? "隐藏中文" : "显示中文")}
                          </button>
                          <button type="button" onClick={favorite}>
                            {t(saved ? "取消收藏" : "收藏文章")}
                          </button>
                          {(["pdf", "word"] as const).map((format) => (
                            <button
                              type="button"
                              key={format}
                              onClick={() =>
                                setExporting({ source: { article }, format })
                              }
                            >
                              {t("导出")} {format === "pdf" ? "PDF" : "Word"}
                            </button>
                          ))}
                          <select
                            value={fontSize}
                            aria-label={t("阅读字号")}
                            onChange={(event) =>
                              setFontSize(event.target.value)
                            }
                          >
                            {["small", "medium", "large"].map((value) => (
                              <option key={value} value={value}>
                                {t(
                                  { small: "小", medium: "中", large: "大" }[
                                    value
                                  ]!,
                                )}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    {article.missing.length ? (
                      <p className="warning">
                        {t("未包含的词汇")}: {article.missing.join(", ")}
                      </p>
                    ) : null}
                    <ArticleReader
                      article={article}
                      active={active}
                      onSelect={selectWord}
                      showChinese={showChinese}
                      fontSize={fontSize}
                    />
                  </div>
                </section>
                <aside
                  className="glossary-panel"
                  id="glossaryPanel"
                  aria-label={t("词汇解析")}
                >
                  <div className="glossary-heading">
                    <h2>{t("词汇解析")}</h2>
                    <div className="definition-pagination">
                      <button
                        type="button"
                        aria-label={t("上一个单词")}
                        onClick={() => nextWord(-1)}
                      >
                        ‹
                      </button>
                      <span>
                        {activeIndex + 1} / {article.lexicon.length}
                      </span>
                      <button
                        type="button"
                        aria-label={t("下一个单词")}
                        onClick={() => nextWord(1)}
                      >
                        ›
                      </button>
                    </div>
                    {reading ? (
                      <button
                        type="button"
                        aria-label={t("关闭词汇解析")}
                        onClick={() => setFocusDefinition(false)}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                  <label className="sr-only" htmlFor="glossary-word">
                    {t("选择单词")}
                  </label>
                  <select
                    id="glossary-word"
                    value={active}
                    onChange={(event) => selectWord(event.target.value)}
                  >
                    {article.lexicon.map((row) => (
                      <option key={wordKey(row.word)} value={wordKey(row.word)}>
                        {row.word}
                      </option>
                    ))}
                  </select>
                  <div id="glossary" className="glossary" tabIndex={0}>
                    {entry ? (
                      <DefinitionCard
                        key={`${active}|${context?.en}`}
                        entry={entry}
                        context={context || undefined}
                        articleMode={article.generationMode}
                        mastery={
                          library.vocabPrefs[active]?.mastery || "unknown"
                        }
                        onMastery={(value) => mastery(entry.word, value)}
                      />
                    ) : (
                      <p>{t("点击高亮词查看释义")}</p>
                    )}
                    {hydrationError ? (
                      <p className="warning" role="status">
                        {t(hydrationError)}{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setHydrationError("");
                            void hydrate(article, openSerial.current);
                          }}
                        >
                          {t("重试")}
                        </button>
                      </p>
                    ) : null}
                  </div>
                  <div className="glossary-footer">
                    <button type="button" onClick={addUnknown}>
                      {t("将陌生词添加到生词本")}
                    </button>
                  </div>
                </aside>
              </div>
            ) : (
              <section className="empty-state">
                <h2>{t("文章阅读")}</h2>
                <div className="empty-body">
                  <h3>{t("输入词汇，生成学习文章")}</h3>
                  <p>
                    {t("点击文章中的高亮词查看释义，标记陌生词后加入生词本。")}
                  </p>
                  <button
                    type="button"
                    onClick={() => openArticle(normalizeArticle(sample))}
                  >
                    {t("查看示例文章")}
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </main>
      {tab === "article" ? (
        <nav className="next-mobile-nav" aria-label={t("移动端学习导航")}>
          {["input", "article", "word"].map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={mobile === value}
              disabled={value !== "input" && !article}
              onClick={() => {
                setMobile(value);
                if (value === "input") setEditor(true);
              }}
            >
              {t({ input: "输入", article: "文章", word: "词汇" }[value]!)}
            </button>
          ))}
        </nav>
      ) : null}
      {reading ? (
        <button
          className="focus-exit-btn"
          type="button"
          onClick={() => {
            setReading(false);
            setFocusDefinition(false);
          }}
        >
          {t("退出阅读模式")} · ESC
        </button>
      ) : null}
      <Footer />
      {guide ? (
        <Modal title="Texta 使用说明" onClose={closeGuide}>
          <ol className="guide-steps">
            {[
              "先输入单词，建议每次 6–15 个。短语中的空格会保留。",
              "每次生成消耗 1 积分；可选择中英混合或双语文章及短文模式。",
              "点击高亮词查看释义、音标、搭配和原文例句，标记陌生或已掌握。",
              "收藏夹和生词本会自动同步；历史记录与输入草稿保存在当前浏览器。",
              "生词本支持搜索、词性筛选、列表、卡片和按首次加入日期排列的日历。",
              "导出前可以修改标题、隐藏中文并调整页边距。",
            ].map((text) => (
              <li key={text}>{t(text)}</li>
            ))}
          </ol>
          <label className="quick-row">
            <input
              type="checkbox"
              checked={guideDismiss}
              onChange={(event) => setGuideDismiss(event.target.checked)}
            />
            {t("下次不再自动弹出")}
          </label>
          <button type="button" className="primary-btn" onClick={closeGuide}>
            {t("我知道了")}
          </button>
        </Modal>
      ) : null}
      {exporting ? (
        <ExportDialog {...exporting} onClose={() => setExporting(null)} />
      ) : null}
    </>
  );
}

"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { addNotebook, type LibraryStore, wordKey } from "@/lib/texta/library";
import type {
  Article,
  LexiconEntry,
  Mastery,
  NotebookEntry,
} from "@/lib/texta/types";
import { api, errorMessage } from "@/lib/texta/api";
import { usePreference, useText } from "./provider";
import { DefinitionCard } from "./definition-card";
import { Modal } from "./shared";

const dateKey = (value: string | Date) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
export function NotebookView({
  store,
  onOpen,
  onExport,
  onMastery,
}: {
  store: LibraryStore;
  onOpen: (article: Article, word?: string) => void;
  onExport: (entries: NotebookEntry[], format: "pdf" | "word") => void;
  onMastery: (word: string, mastery: Mastery) => void;
}) {
  const { library } = useSyncExternalStore(
      store.subscribe,
      store.getSnapshot,
      store.getServerSnapshot,
    ),
    { t } = useText();
  const [view, setView] = usePreference("texta_notebook_view", "list"),
    [calendarSize, setCalendarSize] = usePreference(
      "texta_calendar_size",
      "standard",
    );
  const [category, setCategory] = useState("unknown"),
    [search, setSearch] = useState(""),
    [pos, setPos] = useState("all"),
    [sort, setSort] = useState("az");
  const [month, setMonth] = useState(
      () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ),
    [date, setDate] = useState("");
  const [open, setOpen] = useState<string | null>(null),
    [remove, setRemove] = useState<NotebookEntry | null>(null),
    [error, setError] = useState("");
  const attempted = useRef(new Set<string>()),
    [hydrationAttempt, setHydrationAttempt] = useState(0);
  const entries = library.notebookEntries.filter((row) => !row.deletedAt),
    missingSignature = entries
      .filter((row) => !row.detailsReady)
      .map((row) => row.key)
      .join("|");
  useEffect(() => {
    const missing = store
      .getSnapshot()
      .library.notebookEntries.filter(
        (row) =>
          !row.deletedAt &&
          !row.detailsReady &&
          !attempted.current.has(row.key),
      )
      .slice(0, 120);
    if (!missing.length) return;
    const batchAttempts = attempted.current;
    missing.forEach((row) => batchAttempts.add(row.key));
    const controller = new AbortController();
    void api<{ entries: LexiconEntry[] }>("/api/vocab/details", {
      method: "POST",
      body: { words: missing.map((row) => row.word) },
      signal: controller.signal,
      timeoutMs: 300000,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        store.change((current) =>
          addNotebook(
            current,
            result.entries.filter((entry) =>
              current.notebookEntries.some(
                (row) => row.key === wordKey(entry.word) && !row.deletedAt,
              ),
            ),
          ),
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorMessage(error));
      });
    return () => {
      controller.abort();
      missing.forEach((row) => batchAttempts.delete(row.key));
    };
  }, [store, missingSignature, hydrationAttempt]);
  const rows = useMemo(
    () =>
      library.notebookEntries
        .filter(
          (row) =>
            !row.deletedAt &&
            (library.vocabPrefs[row.key]?.mastery || "unknown") === category &&
            (pos === "all" || row.pos === pos) &&
            `${row.word} ${row.senses.map((sense) => sense.meaning).join(" ")} ${row.collocations?.join(" ")}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "az"
            ? a.word.localeCompare(b.word, "en")
            : (sort === "oldest" ? 1 : -1) *
              a.createdAt.localeCompare(b.createdAt),
        ),
    [library, category, pos, search, sort],
  );
  const visible = date
    ? rows.filter((row) => dateKey(row.createdAt) === date)
    : rows;
  const countsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = dateKey(row.createdAt);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [rows]);
  function monthGrid(display: Date) {
    const year = display.getFullYear(),
      index = display.getMonth(),
      days = new Date(year, index + 1, 0).getDate(),
      first = new Date(year, index, 1).getDay();
    return (
      <div className="calendar-grid">
        {Array.from({ length: first }, (_, blank) => (
          <span className="calendar-blank" key={`blank-${blank}`} />
        ))}
        {Array.from({ length: days }, (_, day) => {
          const key = dateKey(new Date(year, index, day + 1)),
            count = countsByDate.get(key) || 0;
          return (
            <button
              type="button"
              className={`calendar-day ${count ? "has-words" : ""}`}
              key={day}
              disabled={!count}
              onClick={() => setDate(key)}
              aria-label={`${key}: ${count} ${t("个单词")}`}
            >
              <span className="calendar-number">{day + 1}</span>
              {count ? (
                <span className="calendar-count">
                  {count} {t("个单词")}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <section className="notebook-view">
      <div className="notebook-view-head">
        <h2>{t("生词本")}</h2>
        <span>
          {entries.length} {t("个单词")}
        </span>
      </div>
      <div
        className="notebook-category"
        role="group"
        aria-label={t("单词状态")}
      >
        {["unknown", "mastered"].map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={category === value}
            onClick={() => setCategory(value)}
          >
            {t(value === "unknown" ? "生词" : "已掌握")}{" "}
            <span>
              {
                entries.filter(
                  (row) =>
                    (library.vocabPrefs[row.key]?.mastery || "unknown") ===
                    value,
                ).length
              }
            </span>
          </button>
        ))}
      </div>
      <div className="notebook-view-actions">
        <div
          className="notebook-layout-toggle"
          role="group"
          aria-label={t("生词本视图")}
        >
          {["list", "cards", "calendar"].map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={view === value}
              onClick={() => {
                setView(value);
                setDate("");
              }}
            >
              {t({ list: "列表", cards: "卡片", calendar: "日历" }[value]!)}
            </button>
          ))}
        </div>
        <div className="notebook-export-actions">
          {(["pdf", "word"] as const).map((format) => (
            <button
              type="button"
              key={format}
              disabled={!visible.length}
              onClick={() => onExport(visible, format)}
            >
              {t("导出")} {format === "pdf" ? "PDF" : "Word"}
            </button>
          ))}
        </div>
      </div>
      <div className="notebook-toolbar">
        <input
          aria-label={t("搜索生词")}
          type="search"
          placeholder={t("搜索单词、释义或搭配")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label={t("筛选词性")}
          value={pos}
          onChange={(event) => setPos(event.target.value)}
        >
          <option value="all">{t("全部词性")}</option>
          {[...new Set(entries.map((row) => row.pos).filter(Boolean))]
            .sort()
            .map((value) => (
              <option key={value}>{value}</option>
            ))}
        </select>
        <select
          aria-label={t("生词排序")}
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="az">{t("A–Z 字母排序")}</option>
          <option value="newest">{t("加入时间 · 最新在前")}</option>
          <option value="oldest">{t("加入时间 · 最早在前")}</option>
        </select>
      </div>
      {error ? (
        <p className="warning" role="status">
          {t(error)}{" "}
          <button
            type="button"
            onClick={() => {
              attempted.current.clear();
              setError("");
              setHydrationAttempt((value) => value + 1);
            }}
          >
            {t("重试")}
          </button>
        </p>
      ) : null}
      {date ? (
        <div className="notebook-date-bar">
          <button type="button" onClick={() => setDate("")}>
            {t("返回日历")}
          </button>
          <strong>{date}</strong>
          <button
            type="button"
            onClick={() => {
              setDate("");
              setView("list");
            }}
          >
            {t("显示全部")}
          </button>
        </div>
      ) : null}
      {view === "calendar" && !date ? (
        <section
          className="notebook-calendar"
          data-size={calendarSize}
          aria-label={t("生词日历")}
        >
          <div className="calendar-heading">
            <h3>
              {month.getFullYear()}
              {calendarSize !== "mini" ? ` / ${month.getMonth() + 1}` : ""}
            </h3>
            <div className="calendar-navigation">
              <button
                type="button"
                aria-label={t(calendarSize === "mini" ? "上一年" : "上个月")}
                onClick={() =>
                  setMonth(
                    (current) =>
                      new Date(
                        current.getFullYear() -
                          (calendarSize === "mini" ? 1 : 0),
                        current.getMonth() - (calendarSize === "mini" ? 0 : 1),
                        1,
                      ),
                  )
                }
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() =>
                  setMonth(
                    new Date(
                      new Date().getFullYear(),
                      new Date().getMonth(),
                      1,
                    ),
                  )
                }
              >
                {t("今天")}
              </button>
              <button
                type="button"
                aria-label={t(calendarSize === "mini" ? "下一年" : "下个月")}
                onClick={() =>
                  setMonth(
                    (current) =>
                      new Date(
                        current.getFullYear() +
                          (calendarSize === "mini" ? 1 : 0),
                        current.getMonth() + (calendarSize === "mini" ? 0 : 1),
                        1,
                      ),
                  )
                }
              >
                ›
              </button>
            </div>
            <select
              aria-label={t("日历大小")}
              value={calendarSize}
              onChange={(event) => setCalendarSize(event.target.value)}
            >
              <option value="standard">{t("标准")}</option>
              <option value="mini">{t("缩略图")}</option>
            </select>
          </div>
          {calendarSize === "mini" ? (
            <div className="calendar-year-grid">
              {Array.from({ length: 12 }, (_, index) => (
                <section key={index} className="calendar-mini-month">
                  <h4>{index + 1}</h4>
                  {monthGrid(new Date(month.getFullYear(), index, 1))}
                </section>
              ))}
            </div>
          ) : (
            <>
              <div className="calendar-weekdays">
                {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
                  <span key={day}>{t(day)}</span>
                ))}
              </div>
              {monthGrid(month)}
            </>
          )}
        </section>
      ) : (
        <div
          className="notebook-entries"
          data-view={view === "cards" ? "cards" : "list"}
        >
          {visible.length ? (
            visible.map((entry) => (
              <article key={entry.key} className="glossary-item notebook-entry">
                <div className="notebook-entry-head">
                  <button
                    type="button"
                    className="notebook-word-button"
                    onClick={() =>
                      setOpen(open === entry.key ? null : entry.key)
                    }
                    aria-expanded={open === entry.key}
                    aria-label={`${entry.word} ${t("的词汇详情")}`}
                  >
                    {entry.word}
                  </button>
                  <span className="pos-tag">{entry.pos}</span>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() =>
                      onMastery(
                        entry.word,
                        category === "mastered" ? "unknown" : "mastered",
                      )
                    }
                  >
                    {t(category === "mastered" ? "标记陌生" : "已掌握")}
                  </button>
                  <button
                    type="button"
                    aria-label={`${t("删除")}: ${entry.word}`}
                    onClick={() => setRemove(entry)}
                  >
                    {t("删除")}
                  </button>
                </div>
                <p>{entry.senses.map((sense) => sense.meaning).join("；")}</p>
                <div className="notebook-source-row">
                  <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                  {entry.sourceArticle?.article ? (
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() => onOpen(entry.sourceArticle!, entry.word)}
                    >
                      {t("跳转原文")}
                    </button>
                  ) : null}
                </div>
                {open === entry.key ? (
                  <DefinitionCard
                    entry={entry}
                    mastery={category as Mastery}
                    onMastery={(mastery) => onMastery(entry.word, mastery)}
                  />
                ) : null}
              </article>
            ))
          ) : (
            <p className="empty-library">{t("暂无符合条件的单词")}</p>
          )}
        </div>
      )}
      {remove ? (
        <Modal title="确认删除" onClose={() => setRemove(null)}>
          <p>
            {t("确定从生词本删除")} {remove.word}?
          </p>
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              const now = new Date().toISOString();
              store.change((current) => ({
                ...current,
                notebookEntries: current.notebookEntries.map((row) =>
                  wordKey(row.word) === remove.key
                    ? { ...row, deletedAt: now, updatedAt: now }
                    : row,
                ),
              }));
              setRemove(null);
            }}
          >
            {t("确认删除")}
          </button>
        </Modal>
      ) : null}
    </section>
  );
}

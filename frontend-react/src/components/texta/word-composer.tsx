"use client";
import { useEffect, useRef, useState } from "react";
import {
  completion,
  importWords,
  loadDictionary,
  mistake,
  splitWords,
} from "@/lib/texta/words";
import type { GenerationMode } from "@/lib/texta/types";
import { useText } from "./provider";
import { Modal, useDismissPopover } from "./shared";
export interface Draft {
  words: string;
  pending: string;
  mode: GenerationMode;
  short: boolean;
}
export function WordComposer({
  draft,
  update,
  generate,
  preview,
  busy,
  disabled,
}: {
  draft: Draft;
  update: (draft: Draft) => void;
  generate: () => void;
  preview: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  const { t } = useText(),
    input = useRef<HTMLTextAreaElement>(null),
    file = useRef<HTMLInputElement>(null),
    chips = useRef<HTMLDivElement>(null),
    settings = useRef<HTMLDetailsElement>(null);
  useDismissPopover(settings);
  const [dictionaryReady, setDictionaryReady] = useState(false),
    [error, setError] = useState(""),
    [edit, setEdit] = useState<number | null>(null),
    [expanded, setExpanded] = useState(false),
    [overflowing, setOverflowing] = useState(false),
    [completionText, setCompletionText] = useState(""),
    [focused, setFocused] = useState(false),
    [atEnd, setAtEnd] = useState(true);
  useEffect(() => {
    let alive = true;
    void loadDictionary().then(() => {
      if (alive) setDictionaryReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  const words = splitWords(draft.words);
  useEffect(() => {
    const element = chips.current;
    if (!element) return;
    const check = () =>
      setOverflowing(element.scrollHeight > element.clientHeight + 2);
    const frame = requestAnimationFrame(check);
    const observer = new ResizeObserver(check);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [draft.words, expanded]);
  const draftMistake = dictionaryReady ? mistake(draft.pending) : null;
  useEffect(() => {
    const timer = setTimeout(() => {
      setCompletionText(dictionaryReady ? completion(draft.pending) : "");
    }, 180);
    return () => clearTimeout(timer);
  }, [draft.pending, dictionaryReady]);
  const suggestion =
    focused &&
    atEnd &&
    completionText !== draft.pending &&
    completionText.toLowerCase().startsWith(draft.pending.toLowerCase())
      ? completionText
      : "";
  useEffect(() => {
    const field = input.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(140, field.scrollHeight)}px`;
  }, [draft.pending]);
  function commit(text = draft.pending) {
    const all = splitWords([...words, text].join(","));
    if (all.length > 120) {
      setError("一次最多输入 120 个单词或短语。");
      return;
    }
    setError("");
    update({ ...draft, words: all.join(", "), pending: "" });
    input.current?.focus();
  }
  function replace(index: number, word: string) {
    const next = [...words];
    next[index] = word;
    update({ ...draft, words: splitWords(next.join(",")).join(", ") });
  }
  return (
    <section
      id="inputPanel"
      className="input-panel texta-composer"
      aria-label={t("文章生成设置")}
    >
      <div className="word-entry">
        <div className="section-heading">
          <label htmlFor="wordInput">{t("输入词汇")}</label>
          <div className="file-tools-row">
            <button type="button" onClick={() => file.current?.click()}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 16V3m-4 4 4-4 4 4M4 14v6h16v-6" />
              </svg>
              {t("导入文件")}
            </button>
            <button
              className="text-btn"
              type="button"
              disabled={!words.length && !draft.pending}
              onClick={() => {
                update({ ...draft, words: "", pending: "" });
                setError("");
                input.current?.focus();
              }}
            >
              {t("清空")}
            </button>
          </div>
        </div>
        <div className="vocabulary-editor">
          <div
            id="composer-words"
            ref={chips}
            className={`word-chips${expanded ? " is-expanded" : ""}`}
            aria-label={t("输入的词汇")}
          >
            {words.map((word, index) => {
              const correction = dictionaryReady ? mistake(word) : null;
              return (
                <span
                  className={`chip${correction ? " bad" : ""}`}
                  key={word.toLowerCase()}
                >
                  <button
                    type="button"
                    className="chip-edit"
                    onClick={() => setEdit(index)}
                    aria-label={`${t("编辑单词")}: ${word}`}
                  >
                    {correction
                      ? [...word].map((letter, position) => (
                          <span
                            className={
                              correction.positions.includes(position)
                                ? "spelling-letter"
                                : undefined
                            }
                            key={position}
                          >
                            {letter}
                          </span>
                        ))
                      : word}
                  </button>
                  <button
                    type="button"
                    className="chip-remove"
                    aria-label={`${t("移除单词")}: ${word}`}
                    onClick={() =>
                      update({
                        ...draft,
                        words: words.filter((_, i) => i !== index).join(", "),
                      })
                    }
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m6 6 12 12M18 6 6 18" />
                    </svg>
                  </button>
                  {correction ? (
                    <button
                      type="button"
                      className="chip-correction"
                      onClick={() => replace(index, correction.suggestion)}
                    >
                      {t("改为")} {correction.suggestion}
                    </button>
                  ) : null}
                </span>
              );
            })}
          </div>
          {overflowing || expanded ? (
            <button
              type="button"
              className="text-btn expand-words"
              aria-expanded={expanded}
              aria-controls="composer-words"
              onClick={() => setExpanded(!expanded)}
            >
              {t(expanded ? "收起词汇" : "展开全部词汇")}
            </button>
          ) : null}
          <div className={`draft-surface${draftMistake ? " has-paint" : ""}`}>
            {draftMistake ? (
              <div className="draft-paint" aria-hidden="true">
                {[...draft.pending].map((letter, position) => (
                  <span
                    className={
                      draftMistake.positions.includes(position)
                        ? "spelling-letter"
                        : undefined
                    }
                    key={position}
                  >
                    {letter}
                  </span>
                ))}
              </div>
            ) : null}
            {suggestion && suggestion !== draft.pending ? (
              <div
                className="draft-paint composer-completion"
                aria-hidden="true"
              >
                <span>{draft.pending}</span>
                <span className="draft-ghost">
                  {suggestion.slice(draft.pending.length)}
                  <kbd>Tab</kbd>
                </span>
              </div>
            ) : null}
            <textarea
              ref={input}
              id="wordInput"
              aria-label={t("输入单词或短语")}
              autoComplete="off"
              autoCapitalize="off"
              rows={1}
              aria-describedby="composer-help composer-count composer-completion"
              spellCheck={false}
              value={draft.pending}
              placeholder={t(
                words.length
                  ? "继续输入单词或短语…"
                  : "粘贴或输入你想学习的单词与短语…",
              )}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSelect={(event) =>
                setAtEnd(
                  event.currentTarget.selectionStart === draft.pending.length &&
                    event.currentTarget.selectionEnd === draft.pending.length,
                )
              }
              onChange={(event) =>
                update({ ...draft, pending: event.target.value })
              }
              onPaste={(event) => {
                const text = event.clipboardData.getData("text");
                if (/[,，;；\n]/.test(text)) {
                  event.preventDefault();
                  commit(draft.pending + text);
                }
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (
                  event.key === "Enter" ||
                  event.key === "," ||
                  event.key === "，"
                ) {
                  event.preventDefault();
                  commit();
                } else if (
                  event.key === "Tab" &&
                  !event.shiftKey &&
                  suggestion
                ) {
                  event.preventDefault();
                  update({ ...draft, pending: suggestion });
                  requestAnimationFrame(() =>
                    input.current?.setSelectionRange(
                      suggestion.length,
                      suggestion.length,
                    ),
                  );
                } else if (event.key === "Escape") setCompletionText("");
              }}
            />
          </div>
          <span id="composer-completion" className="sr-only" role="status">
            {suggestion ? `${suggestion} · Tab` : ""}
          </span>
        </div>
        <div className="input-tools">
          <span id="composer-help" className="field-help">
            {t("逗号或回车添加 · 点击词汇编辑")}
          </span>
          <span id="composer-count" className="count" aria-live="polite">
            {words.length} / 120 {t("个词")}
          </span>
        </div>
        <input
          ref={file}
          type="file"
          hidden
          accept=".txt,.csv,.json,.md"
          onChange={async (event) => {
            const selected = event.target.files?.[0];
            event.target.value = "";
            if (!selected) return;
            if (selected.size > 1048576) {
              setError("词表文件不能超过 1 MB。");
              return;
            }
            try {
              commit(importWords(await selected.text(), selected.name));
            } catch {
              setError("无法读取词表，请检查文件格式。");
            }
          }}
        />
        {error ? (
          <p role="status" className="warning">
            {t(error)}
          </p>
        ) : null}
      </div>
      <div className="generation-settings">
        <div
          className="generation-mode"
          role="group"
          aria-label={t("文章模式")}
          data-mode={draft.mode}
        >
          {(["mixed", "standard"] as GenerationMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={draft.mode === mode}
              onClick={() => update({ ...draft, mode })}
            >
              {t(mode === "mixed" ? "中英混合" : "双语文章")}
            </button>
          ))}
        </div>
        <details ref={settings} className="generation-more">
          <summary>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 7h8m4 0h6M3 17h3m4 0h11" />
              <circle cx="13" cy="7" r="2" />
              <circle cx="8" cy="17" r="2" />
            </svg>
            {t("更多设置")}
          </summary>
          <div className="generation-popover">
            <label className="switch-label">
              <input
                type="checkbox"
                role="switch"
                checked={draft.short}
                onChange={(event) =>
                  update({ ...draft, short: event.target.checked })
                }
              />
              {t("短文模式")}
            </label>
            <p className="field-help">{t("减少背景，保留完整故事")}</p>
          </div>
        </details>
        <div className="generation-submit">
          <span className="generation-summary">{t("普通生成 · 1 积分")}</span>
          <button
            id="generateBtn"
            type="button"
            className="primary-btn generate-btn"
            disabled={
              busy || disabled || (!words.length && !draft.pending.trim())
            }
            aria-busy={busy}
            onClick={generate}
          >
            <span>{t(busy ? "正在生成文章…" : "生成文章")}</span>
            {!busy ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12h16m-6-6 6 6-6 6" />
              </svg>
            ) : null}
          </button>
        </div>
        <button
          className="text-btn composer-example"
          type="button"
          onClick={preview}
        >
          {t("查看示例")}
        </button>
      </div>
      {edit !== null ? (
        <Modal title="编辑单词" onClose={() => setEdit(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const value = String(
                new FormData(event.currentTarget).get("word") || "",
              ).trim();
              if (value) {
                replace(edit, value);
                setEdit(null);
              }
            }}
          >
            <label htmlFor="edit-word">{t("单词或短语")}</label>
            <input
              id="edit-word"
              name="word"
              defaultValue={words[edit]}
              required
              maxLength={120}
              autoFocus
            />
            <button type="submit" className="primary-btn">
              {t("保存")}
            </button>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}

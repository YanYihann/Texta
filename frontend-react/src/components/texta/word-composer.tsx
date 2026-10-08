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
import { Modal } from "./shared";
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
    input = useRef<HTMLInputElement>(null),
    file = useRef<HTMLInputElement>(null);
  const [dictionaryReady, setDictionaryReady] = useState(false),
    [error, setError] = useState(""),
    [edit, setEdit] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    void loadDictionary().then(() => {
      if (alive) setDictionaryReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  const words = splitWords(draft.words),
    suggestion = dictionaryReady ? completion(draft.pending) : "";
  function commit(text = draft.pending) {
    const all = splitWords([...words, text].join(","));
    if (all.length > 120) {
      setError("一次最多输入 120 个单词或短语。");
      return;
    }
    update({ ...draft, words: all.join(", "), pending: "" });
    input.current?.focus();
  }
  function replace(index: number, word: string) {
    const next = [...words];
    next[index] = word;
    update({ ...draft, words: splitWords(next.join(",")).join(", ") });
  }
  return (
    <section id="inputPanel" className="input-panel">
      <div className="word-entry">
        <div className="section-heading">
          <h2>{t("输入单词")}</h2>
          <span>{words.length} / 120</span>
        </div>
        <p className="hint">{t("输入单词或短语，用逗号或回车分隔。")}</p>
        <div className="word-chip-container">
          {words.map((word, index) => {
            const correction = dictionaryReady ? mistake(word) : null;
            return (
              <span className="word-chip" key={`${index}-${word}`}>
                <button
                  type="button"
                  className={correction ? "spell-warning" : ""}
                  onClick={() => setEdit(index)}
                  aria-label={`${t("编辑单词")}: ${word}`}
                >
                  {word}
                </button>
                <button
                  type="button"
                  aria-label={`${t("移除单词")}: ${word}`}
                  onClick={() =>
                    update({
                      ...draft,
                      words: words.filter((_, i) => i !== index).join(", "),
                    })
                  }
                >
                  ×
                </button>
                {correction ? (
                  <button
                    type="button"
                    className="spelling-suggestion"
                    onClick={() => replace(index, correction.suggestion)}
                  >
                    {t("改为")} {correction.suggestion}
                  </button>
                ) : null}
              </span>
            );
          })}
        </div>
        <div className="word-entry-row">
          <input
            ref={input}
            id="wordInput"
            aria-label={t("输入单词或短语")}
            autoComplete="off"
            spellCheck={false}
            value={draft.pending}
            placeholder="resilient, sustainable, adapt…"
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
              if (
                event.key === "Enter" ||
                event.key === "," ||
                event.key === "，"
              ) {
                event.preventDefault();
                commit();
              } else if (event.key === "Tab" && suggestion) {
                event.preventDefault();
                update({ ...draft, pending: suggestion });
              }
            }}
          />
          <button
            type="button"
            onClick={() => commit()}
            disabled={!draft.pending.trim()}
          >
            {t("添加")}
          </button>
        </div>
        {suggestion ? (
          <button
            className="completion-hint"
            type="button"
            onClick={() => update({ ...draft, pending: suggestion })}
          >
            {suggestion} · Tab
          </button>
        ) : null}
        <div className="composer-tools">
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
          <button type="button" onClick={() => file.current?.click()}>
            {t("导入词表")}
          </button>
          <button
            type="button"
            onClick={() => update({ ...draft, words: "", pending: "" })}
          >
            {t("清空")}
          </button>
          <button type="button" onClick={preview}>
            {t("查看示例")}
          </button>
        </div>
      </div>
      <div className="generation-settings">
        <div className="generation-options">
          <label>
            {t("文章模式")}
            <select
              aria-label={t("文章模式")}
              value={draft.mode}
              onChange={(event) =>
                update({ ...draft, mode: event.target.value as GenerationMode })
              }
            >
              <option value="mixed">{t("中英混合")}</option>
              <option value="standard">{t("双语文章")}</option>
            </select>
          </label>
          <label className="quick-row">
            <input
              type="checkbox"
              checked={draft.short}
              onChange={(event) =>
                update({ ...draft, short: event.target.checked })
              }
            />
            {t("短文模式")}
          </label>
        </div>
        <p role="status" className="warning">
          {t(error)}
        </p>
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
          {t(busy ? "正在生成文章…" : "生成文章")}
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

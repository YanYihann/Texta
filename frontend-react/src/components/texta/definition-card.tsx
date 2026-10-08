"use client";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/texta/api";
import type { LexiconEntry, Mastery } from "@/lib/texta/types";
import { useText } from "./provider";

export function DefinitionCard({
  entry,
  mastery,
  onMastery,
  context,
  articleMode = "standard",
}: {
  entry: LexiconEntry;
  mastery: Mastery;
  onMastery: (mastery: Mastery) => void;
  context?: { en: string; zh: string };
  articleMode?: string;
}) {
  const { t } = useText();
  const [translated, setTranslated] = useState(""),
    [translationError, setTranslationError] = useState("");
  const sentence = context?.en || "",
    existingTranslation = context?.zh || "";
  useEffect(() => {
    if (!sentence || existingTranslation || articleMode === "mixed") return;
    const controller = new AbortController();
    void api<{ translation: string }>("/api/context/translation", {
      method: "POST",
      body: { sentence },
      signal: controller.signal,
    })
      .then((result) => {
        setTranslated(result.translation);
        setTranslationError("");
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setTranslationError(errorMessage(error));
      });
    return () => controller.abort();
  }, [sentence, existingTranslation, articleMode]);
  function speak(language: "us" | "uk") {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(entry.word);
    utterance.lang = language === "us" ? "en-US" : "en-GB";
    const voices = speechSynthesis.getVoices();
    utterance.voice =
      voices.find((voice) => voice.lang.replace("_", "-") === utterance.lang) ||
      null;
    speechSynthesis.speak(utterance);
  }
  return (
    <article className="glossary-item active">
      <div className="glossary-title">
        <h3 className="glossary-word">{entry.word}</h3>
        <span className="pos-tag">{entry.pos}</span>
      </div>
      <div className="pronunciation-line">
        {(["us", "uk"] as const).map((language) => (
          <button
            key={language}
            className="speak-btn"
            type="button"
            onClick={() => speak(language)}
            aria-label={`${t(language === "us" ? "美音" : "英音")}: ${entry.word}`}
          >
            <span>{t(language === "us" ? "美音" : "英音")}</span>{" "}
            <span className="speak-ipa">
              {entry[language === "us" ? "usIpa" : "ukIpa"] || entry.ipa || "—"}
            </span>
          </button>
        ))}
      </div>
      <p className="definition-summary">{entry.senses?.[0]?.meaning}</p>
      <div className="mastery-toggle" role="group" aria-label={t("掌握状态")}>
        {(["mastered", "unknown"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={mastery === value ? "selected" : ""}
            aria-pressed={mastery === value}
            onClick={() => onMastery(value)}
          >
            {t(value === "mastered" ? "已掌握" : "陌生")}
          </button>
        ))}
      </div>
      <section className="glossary-section">
        <h4>{t("词义")}</h4>
        {(entry.senses || []).map((sense, index) => (
          <p className="sense-line" key={index}>
            <span className="sense-marker">
              {sense.marker || `${index + 1}.`}
            </span>{" "}
            {sense.meaning}
          </p>
        ))}
        {entry.baseMeanings?.filter(
          (meaning) => !entry.senses.some((sense) => sense.meaning === meaning),
        ).length ? (
          <details>
            <summary>{t("词典的其他义项")}</summary>
            {entry.baseMeanings
              .filter(
                (meaning) =>
                  !entry.senses.some((sense) => sense.meaning === meaning),
              )
              .map((meaning) => (
                <p key={meaning}>{meaning}</p>
              ))}
          </details>
        ) : null}
      </section>
      {entry.collocations?.length ? (
        <section className="glossary-section">
          <h4>{t("常见搭配")}</h4>
          <ul className="collocation-list">
            {entry.collocations.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {context?.en ? (
        <section className="glossary-section article-context">
          <h4>{t("在本文中")}</h4>
          <p className="context-label">{t("原文例句")}</p>
          <blockquote>{context.en}</blockquote>
          <p className="context-label">{t("例句译文")}</p>
          <p>
            {existingTranslation ||
              translated ||
              t(translationError || "正在翻译例句…")}
          </p>
        </section>
      ) : null}
      <details className="word-expansion">
        <summary>{t("词汇扩展")}</summary>
        {entry.wordFormation ? (
          <>
            <h4>{t("构词")}</h4>
            <p>{entry.wordFormation}</p>
          </>
        ) : null}
        <h4>{t("近义词")}</h4>
        <p>{entry.synonyms?.join(" · ") || "—"}</p>
        <h4>{t("反义词")}</h4>
        <p>{entry.antonyms?.join(" · ") || "—"}</p>
      </details>
    </article>
  );
}

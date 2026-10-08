"use client";
import { Fragment, memo } from "react";
import type { Article } from "@/lib/texta/types";
import { highlights } from "@/lib/texta/reading";
import { wordKey } from "@/lib/texta/library";
import { useText } from "./provider";

export type SelectWord = (
  word: string,
  paragraph?: number,
  sentence?: number,
) => void;
function Mark({
  word,
  active,
  onSelect,
  paragraph,
  sentence,
  children,
  language = "en",
}: {
  word: string;
  active: string;
  onSelect: SelectWord;
  paragraph?: number;
  sentence?: number;
  children: React.ReactNode;
  language?: string;
}) {
  const { t } = useText();
  const activate = () => onSelect(word, paragraph, sentence);
  return (
    <mark
      className={`vocab-${language} ${wordKey(word) === active ? "vocab-active" : ""}`}
      data-word-key={wordKey(word)}
      role="button"
      tabIndex={0}
      aria-label={`${t("词汇解析")}: ${word}`}
      onClick={activate}
      onKeyDown={(event) => {
        if (["Enter", " "].includes(event.key)) {
          event.preventDefault();
          activate();
        }
      }}
    >
      {children}
    </mark>
  );
}
function Highlighted({
  article,
  text,
  paragraph,
  language,
  active,
  onSelect,
}: {
  article: Article;
  text: string;
  paragraph: number;
  language: "en" | "zh";
  active: string;
  onSelect: SelectWord;
}) {
  const spans = highlights(article, text, paragraph, language),
    nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue;
    nodes.push(
      text.slice(cursor, span.start),
      <Mark
        key={`${span.start}-${span.word}`}
        {...span}
        active={active}
        onSelect={onSelect}
        language={language}
      >
        {text.slice(span.start, span.end)}
      </Mark>,
    );
    cursor = span.end;
  }
  nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}
export const ArticleReader = memo(function ArticleReader({
  article,
  active,
  onSelect,
  showChinese = true,
  fontSize = "medium",
}: {
  article: Article;
  active: string;
  onSelect: SelectWord;
  showChinese?: boolean;
  fontSize?: string;
}) {
  const paragraphs = article.paragraphsEn.length
    ? article.paragraphsEn
    : article.article.split(/\n\s*\n/);
  return (
    <section
      id="exportArea"
      className={`export-area font-${fontSize}`}
      tabIndex={0}
      aria-label="文章阅读"
    >
      <h3 className="article-title">{article.title}</h3>
      <div className="article-blocks">
        {article.generationMode === "mixed" && article.runs.length ? (
          <div className="para-card mixed-mode">
            <p className="para-en next-mixed-content">
              {article.runs.map((run, index) =>
                run.type === "word" ? (
                  <span className="mixed-vocab" key={index}>
                    <Mark
                      word={run.word || run.text}
                      paragraph={run.paragraphIndex}
                      active={active}
                      onSelect={onSelect}
                    >
                      {run.text}
                    </Mark>
                    {showChinese ? (
                      <span className="mixed-note">
                        <span>{run.pos}</span>{" "}
                        {run.displayMeaning || run.meaning}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <Fragment key={index}>{run.text}</Fragment>
                ),
              )}
            </p>
          </div>
        ) : (
          paragraphs.map((paragraph, index) => (
            <section className="para-card" key={index}>
              <p className="para-en">
                <Highlighted
                  article={article}
                  text={paragraph}
                  paragraph={index}
                  language="en"
                  active={active}
                  onSelect={onSelect}
                />
              </p>
              {showChinese && article.paragraphsZh[index] ? (
                <p className="para-zh">
                  <Highlighted
                    article={article}
                    text={article.paragraphsZh[index]}
                    paragraph={index}
                    language="zh"
                    active={active}
                    onSelect={onSelect}
                  />
                </p>
              ) : null}
            </section>
          ))
        )}
      </div>
    </section>
  );
});

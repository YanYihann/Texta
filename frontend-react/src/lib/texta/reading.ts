import type { Article, LexiconEntry } from "./types";
import { wordKey } from "./library";

export interface Highlight {
  start: number;
  end: number;
  word: string;
  paragraph: number;
  sentence?: number;
}
export const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function highlights(
  article: Article,
  text: string,
  paragraph: number,
  language: "en" | "zh",
): Highlight[] {
  const exact: Highlight[] = [];
  for (const row of article.alignment)
    for (const occurrence of row.occurrences || []) {
      if (occurrence.paragraph !== paragraph) continue;
      const start = language === "en" ? occurrence.enStart : occurrence.zhStart,
        end = language === "en" ? occurrence.enEnd : occurrence.zhEnd;
      if (start >= 0 && end > start && end <= text.length)
        exact.push({
          start,
          end,
          word: row.word,
          paragraph,
          sentence: occurrence.sentence,
        });
    }
  if (exact.length) return exact.sort((a, b) => a.start - b.start);
  const matches: Highlight[] = [];
  const candidates =
    language === "en"
      ? [
          ...article.alignment.flatMap((row) =>
            (row.english_forms || []).map((text) => ({ text, word: row.word })),
          ),
          ...article.words.map((word) => ({ text: word, word })),
        ]
      : article.alignment.flatMap((row) =>
          (row.zh_terms || []).map((term) => ({ text: term, word: row.word })),
        );
  const sorted = candidates
    .filter((row) => row.text)
    .sort((a, b) => b.text.length - a.text.length);
  for (const candidate of sorted) {
    const pattern = new RegExp(
      language === "en"
        ? `(?<![A-Za-z])${escapeRegExp(candidate.text)}(?![A-Za-z])`
        : escapeRegExp(candidate.text),
      language === "en" ? "gi" : "g",
    );
    for (const match of text.matchAll(pattern)) {
      const start = match.index!,
        end = start + match[0].length;
      if (!matches.some((old) => start < old.end && end > old.start))
        matches.push({ start, end, word: candidate.word, paragraph });
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}
export function articleContext(
  article: Article,
  word: string,
  paragraph?: number,
  sentence?: number,
) {
  if (paragraph !== undefined && sentence !== undefined) {
    const pair = article.sentencePairs.filter(
      (row) => row.paragraph === paragraph,
    )[sentence];
    if (pair) return { en: pair.en, zh: pair.zh };
  }
  const regex = new RegExp(
    `(?<![A-Za-z])${escapeRegExp(word)}(?![A-Za-z])`,
    "i",
  );
  const paired = article.sentencePairs.find((row) => regex.test(row.en));
  if (paired) return { en: paired.en, zh: paired.zh };
  const paragraphs = article.paragraphsEn.length
    ? article.paragraphsEn
    : article.article.split(/\n\s*\n/);
  const block =
    (paragraph === undefined ? undefined : paragraphs[paragraph]) ||
    paragraphs.find((text) => regex.test(text)) ||
    article.article;
  const en =
    block.split(/(?<=[。！？.!?])\s*/).find((text) => regex.test(text)) ||
    block;
  if (article.generationMode === "mixed") {
    let zh = en;
    for (const gloss of article.contextGlosses)
      if (gloss.contextMeaning || gloss.meaning)
        zh = zh.replace(
          new RegExp(
            `(?<![A-Za-z])${escapeRegExp(gloss.word)}(?![A-Za-z])`,
            "gi",
          ),
          gloss.contextMeaning || gloss.meaning || "",
        );
    return { en, zh };
  }
  return { en, zh: "" };
}
export function hydrateLexicon(
  article: Article,
  entries: LexiconEntry[],
): Article {
  const cards = new Map(entries.map((row) => [wordKey(row.word), row]));
  return {
    ...article,
    baseLexicon: article.words.map(
      (word) =>
        cards.get(wordKey(word)) ||
        article.baseLexicon.find(
          (row) => wordKey(row.word) === wordKey(word),
        ) || { word, senses: [] },
    ),
    lexicon: article.words.map((word) => {
      const old = article.lexicon.find(
          (row) => wordKey(row.word) === wordKey(word),
        ),
        full = cards.get(wordKey(word));
      return {
        ...(old || { word, senses: [] }),
        ...full,
        ...(old?.senses?.length
          ? { senses: old.senses, pos: old.pos || full?.pos }
          : {}),
      };
    }),
  };
}

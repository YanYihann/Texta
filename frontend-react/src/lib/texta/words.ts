import { wordKey } from "./library";
let words: string[] = [],
  known: Set<string> | null = null,
  loading: Promise<void> | null = null;
const preferred =
  "resilient sustainable perspective adapt thrive balance environment experience opportunity education development communicate knowledge achieve benefit challenge community consider create culture describe discover efficient encourage essential evidence improve include increase individual influence information maintain natural necessary organise organize particular possible practice practise prepare process protect provide purpose quality receive reduce relationship require research resource responsible significant solution support technology understand university variety because beautiful different definitely accommodation separate successful".split(
    " ",
  );
const cache = new Map<
  string,
  { suggestion: string; positions: number[] } | null
>();
function startOf(prefix: string) {
  let lo = 0,
    hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (words[mid] < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
export async function loadDictionary() {
  if (!loading)
    loading = fetch("/vendor/english-words.txt")
      .then((response) => {
        if (!response.ok) throw Error("Dictionary unavailable");
        return response.text();
      })
      .then((source) => {
        words = source
          .split(/\r?\n/)
          .filter((word) => /^[a-z]+$/.test(word))
          .sort();
        if (words.length < 10000) throw Error("Incomplete word list");
        known = new Set(words);
        known.add("a");
        known.add("i");
      })
      .catch(() => {
        words = [];
        known = null;
        loading = null;
      });
  return loading;
}
export function completion(raw: string) {
  if (!known || !/^[a-z]{2,32}$/i.test(raw)) return "";
  const prefix = raw.toLowerCase();
  if (known.has(prefix)) return "";
  const candidate =
    preferred.find((word) => word.startsWith(prefix) && known!.has(word)) ||
    words
      .slice(startOf(prefix), startOf(prefix) + 80)
      .filter((word) => word.startsWith(prefix))
      .sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
  return candidate
    ? raw === raw.toUpperCase()
      ? candidate.toUpperCase()
      : raw + candidate.slice(raw.length)
    : "";
}
export function mistake(raw: string) {
  const token = raw.toLowerCase();
  if (
    !known ||
    raw !== token ||
    !/^[a-z]{4,24}$/.test(token) ||
    known.has(token) ||
    words[startOf(token)]?.startsWith(token)
  )
    return null;
  if (cache.has(token)) return cache.get(token)!;
  const candidates = new Map<string, number[]>();
  const add = (word: string, positions: number[]) => {
    if (known!.has(word)) candidates.set(word, positions);
  };
  for (let i = 0; i < token.length; i++) {
    add(token.slice(0, i) + token.slice(i + 1), [i]);
    if (i + 1 < token.length)
      add(token.slice(0, i) + token[i + 1] + token[i] + token.slice(i + 2), [
        i,
        i + 1,
      ]);
    for (const letter of "abcdefghijklmnopqrstuvwxyz") {
      add(token.slice(0, i) + letter + token.slice(i + 1), [i]);
      add(token.slice(0, i) + letter + token.slice(i), [i]);
    }
  }
  const common = preferred.filter((word) => candidates.has(word));
  const correction =
    common.length === 1
      ? common[0]
      : candidates.size === 1
        ? [...candidates.keys()][0]
        : "";
  const result = correction
    ? { suggestion: correction, positions: candidates.get(correction)! }
    : null;
  if (cache.size > 500) cache.clear();
  cache.set(token, result);
  return result;
}
export function splitWords(text: string) {
  const seen = new Set<string>();
  return text
    .split(/[,，;；\n\r]+/)
    .map((word) => word.trim().replace(/\s+/g, " "))
    .filter((word) => {
      const key = wordKey(word);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
export function importWords(text: string, filename: string) {
  if (/\.json$/i.test(filename)) {
    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed) ? parsed : parsed.words;
    if (!Array.isArray(list))
      throw Error("JSON 文件需要单词数组或 words 字段。");
    return list
      .map((item: unknown) =>
        typeof item === "string"
          ? item
          : typeof item === "object" && item && "word" in item
            ? String(item.word)
            : "",
      )
      .filter(Boolean)
      .join(", ");
  }
  return text.replace(/^\s*(?:[-*]|\d+[.)])\s+/gm, "").replace(/["`]/g, "");
}

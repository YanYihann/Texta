import type { Article, LexiconEntry, NotebookEntry } from "./types";
import { highlights, articleProse } from "./reading";
import { dictionary } from "./translations";

export interface ExportSource {
  article?: Article;
  entries?: NotebookEntry[];
}
export interface ExportSettings {
  title: string;
  includeChinese: boolean;
  margin: number;
  language?: string;
}
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
function highlighted(
  article: Article,
  text: string,
  index: number,
  language: "en" | "zh",
) {
  const spans = highlights(article, text, index, language);
  let cursor = 0,
    html = "";
  for (const span of spans) {
    if (span.start < cursor) continue;
    html +=
      escape(articleProse(text.slice(cursor, span.start))) +
      `<mark>${escape(articleProse(text.slice(span.start, span.end)))}</mark>`;
    cursor = span.end;
  }
  return html + escape(articleProse(text.slice(cursor)));
}
export const EXPORT_STYLE = `.texta-export-doc{color:#222724;background:#fff;font:16px/1.7 'Segoe UI','Microsoft YaHei',sans-serif;overflow-wrap:anywhere}.texta-export-doc h1{font:700 30px/1.25 Georgia,'Songti SC',serif;margin:0 0 24px}.texta-export-doc h2{font:700 24px/1.3 Georgia,serif;margin:0 0 6px}.texta-export-doc p{margin:0 0 12px}.texta-export-doc .en{font:20px/1.6 Georgia,'Songti SC',serif}.texta-export-doc .zh{font-size:15px;color:#505a51}.texta-export-doc mark{background:#dae8d4;color:#294e37;font-weight:700}.texta-export-doc .export-block{margin:0 0 20px;break-inside:avoid}.texta-export-doc small{font:13px/1.4 'Segoe UI','Microsoft YaHei',sans-serif;color:#606963}.texta-export-doc .mixed-word{display:inline-flex;flex-direction:column;text-align:center;vertical-align:baseline;margin:0 2px}.texta-export-doc .mixed-word small{margin-top:2px}.texta-export-doc .mixed{white-space:pre-wrap;font:20px/2 Georgia,'Songti SC',serif}.texta-export-doc .export-vocabulary-section{margin-bottom:20px}.texta-export-doc .export-vocabulary-section h2{font:600 20px/1.4 'Segoe UI','Microsoft YaHei',sans-serif;margin:24px 0 12px}.texta-export-doc .export-vocabulary{width:100%;border-collapse:collapse;table-layout:fixed;font-size:15px}.texta-export-doc .export-vocabulary th{text-align:left;background:#edf2eb;font-weight:600}.texta-export-doc .export-vocabulary th,.texta-export-doc .export-vocabulary td{padding:10px 12px;border-bottom:1px solid #dce3da;vertical-align:top;overflow-wrap:anywhere}.texta-export-doc .export-vocabulary th:nth-child(1){width:29%}.texta-export-doc .export-vocabulary th:nth-child(2){width:15%}.texta-export-doc .export-vocabulary td:first-child{font-family:Georgia,serif;font-weight:600}.texta-export-doc .export-vocabulary thead{display:table-header-group}.texta-export-doc .export-vocabulary tr{break-inside:avoid}`;
function vocabularyTable(
  rows: LexiconEntry[],
  settings: ExportSettings,
  heading = false,
) {
  const label = (text: string) =>
    escape(settings.language === "en" ? dictionary[text] || text : text);
  const cells = rows
    .map(
      (entry) =>
        `<tr><td>${escape(articleProse(entry.word))}</td><td>${escape(entry.pos || "—")}</td><td>${
          escape(
            articleProse(
              (entry.senses || [])
                .map((sense) => sense.meaning)
                .filter(Boolean)
                .join("；"),
            ),
          ) || "—"
        }</td></tr>`,
    )
    .join("");
  return `<section class="export-vocabulary-section">${heading ? `<h2>${label("词汇表")}</h2>` : ""}<table class="export-vocabulary"><thead><tr><th scope="col">${label("英文")}</th><th scope="col">${label("词性")}</th><th scope="col">${label("中文翻译")}</th></tr></thead><tbody>${cells}</tbody></table></section>`;
}
export function buildExportHtml(
  source: ExportSource,
  settings: ExportSettings,
) {
  let blocks = `<header class="export-block"><h1>${escape(settings.title)}</h1></header>`;
  if (source.article) {
    const article = source.article;
    if (article.generationMode === "mixed" && article.runs.length) {
      let paragraph = "";
      const flush = () => {
        if (paragraph)
          blocks += `<section class="export-block mixed">${paragraph}</section>`;
        paragraph = "";
      };
      for (const run of article.runs) {
        if (run.type === "word")
          paragraph += `<span class="mixed-word"><mark>${escape(articleProse(run.text))}</mark>${settings.includeChinese ? `<small>${escape(run.pos)} ${escape(articleProse(run.displayMeaning || run.meaning || ""))}</small>` : ""}</span>`;
        else {
          const parts = run.text.split(/\n\s*\n/);
          for (let i = 0; i < parts.length; i++) {
            if (i) flush();
            paragraph += escape(articleProse(parts[i]));
          }
        }
      }
      flush();
    } else
      for (const [index, paragraph] of (article.paragraphsEn.length
        ? article.paragraphsEn
        : article.article.split(/\n\s*\n/)
      ).entries()) {
        blocks += `<section class="export-block"><p class="en">${highlighted(article, paragraph, index, "en")}</p>${settings.includeChinese && article.paragraphsZh[index] ? `<p class="zh">${highlighted(article, article.paragraphsZh[index], index, "zh")}</p>` : ""}</section>`;
      }
    const rows = [...article.lexicon];
    const present = new Set(rows.map((row) => row.word.trim().toLowerCase()));
    for (const word of article.words) {
      if (present.has(word.trim().toLowerCase())) continue;
      const base = article.baseLexicon.find(
        (row) => row.word.toLowerCase() === word.toLowerCase(),
      );
      const gloss = article.contextGlosses.find(
        (row) => row.word.toLowerCase() === word.toLowerCase(),
      );
      const meaning = gloss?.contextMeaning || gloss?.meaning;
      rows.push({
        word,
        pos: gloss?.pos || base?.pos,
        senses: meaning ? [{ meaning }] : base?.senses || [],
      });
      present.add(word.trim().toLowerCase());
    }
    blocks += vocabularyTable(rows, settings, true);
  } else blocks += vocabularyTable(source.entries || [], settings);
  return `<main class="texta-export-doc">${blocks}</main>`;
}
function filename(title: string, extension: string) {
  return `${title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 100) || "Texta"}.${extension}`;
}
export function exportWord(source: ExportSource, settings: ExportSettings) {
  const document = `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page{size:A4;margin:${settings.margin}mm}${EXPORT_STYLE}</style></head><body>${buildExportHtml(source, settings)}</body></html>`;
  const url = URL.createObjectURL(
    new Blob(["\ufeff", document], {
      type: "application/msword;charset=utf-8",
    }),
  );
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename(settings.title, "doc");
  window.document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
interface PdfDocument {
  addPage: () => void;
  addImage: (
    data: string,
    type: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  save: (name: string) => void;
}
interface ExportWindow extends Window {
  html2canvas?: (
    element: HTMLElement,
    options: { scale: number; useCORS: boolean; backgroundColor: string },
  ) => Promise<HTMLCanvasElement>;
  jspdf?: {
    jsPDF: new (options: {
      orientation: string;
      unit: string;
      format: string;
    }) => PdfDocument;
  };
}
const scripts = new Map<string, Promise<void>>();
function loadScript(src: string) {
  if (!scripts.has(src))
    scripts.set(
      src,
      new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => {
          script.remove();
          scripts.delete(src);
          reject(Error("PDF 导出组件未能加载，请检查网络。"));
        };
        document.head.append(script);
      }),
    );
  return scripts.get(src)!;
}
export async function exportPdf(
  source: ExportSource,
  settings: ExportSettings,
) {
  await Promise.all([
    loadScript("/vendor/html2canvas-1.4.1.min.js"),
    loadScript("/vendor/jspdf-4.2.1.umd.min.js"),
  ]);
  const runtime = window as ExportWindow;
  if (!runtime.html2canvas || !runtime.jspdf)
    throw Error("PDF 导出组件不可用。");
  await document.fonts.ready;
  const widthMm = 210 - settings.margin * 2,
    heightMm = 297 - settings.margin * 2,
    widthPx = (widthMm * 96) / 25.4,
    heightPx = (heightMm * 96) / 25.4;
  const host = document.createElement("div");
  host.style.cssText = `position:absolute;left:-10000px;top:0;width:${widthPx}px;background:#fff;`;
  const style = document.createElement("style");
  style.textContent = EXPORT_STYLE;
  host.append(style);
  const sourceElement = document.createElement("div");
  sourceElement.innerHTML = buildExportHtml(source, settings);
  const blocks = [
    ...sourceElement.querySelectorAll<HTMLElement>(
      ".export-block, .export-vocabulary-section",
    ),
  ];
  document.body.append(host);
  const pdf = new runtime.jspdf.jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  let first = true;
  const paper = document.createElement("div");
  paper.className = "texta-export-doc";
  paper.style.width = `${widthPx}px`;
  host.append(paper);
  const capture = async () => {
    if (!paper.children.length) return;
    const canvas = await runtime.html2canvas!(paper, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });
    // Each normal page is rendered separately, keeping large notebooks below browser canvas limits.
    const pagePixels = Math.floor(heightPx * 2);
    for (let offset = 0; offset < canvas.height; offset += pagePixels) {
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = Math.min(pagePixels, canvas.height - offset);
      slice
        .getContext("2d")!
        .drawImage(
          canvas,
          0,
          offset,
          canvas.width,
          slice.height,
          0,
          0,
          slice.width,
          slice.height,
        );
      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(
        slice.toDataURL("image/jpeg", 0.94),
        "JPEG",
        settings.margin,
        settings.margin,
        widthMm,
        (slice.height / slice.width) * widthMm,
      );
    }
    paper.replaceChildren();
  };
  try {
    for (const block of blocks) {
      const sourceTable = block.querySelector("table.export-vocabulary");
      if (sourceTable instanceof HTMLTableElement) {
        // Paginate by row and repeat the heading instead of slicing a long table image.
        const startTable = () => {
          const part = block.cloneNode(false) as HTMLElement;
          const heading = block.querySelector("h2");
          if (heading) part.append(heading.cloneNode(true));
          const table = sourceTable.cloneNode(false) as HTMLTableElement;
          if (sourceTable.tHead)
            table.append(sourceTable.tHead.cloneNode(true));
          const body = document.createElement("tbody");
          table.append(body);
          part.append(table);
          paper.append(part);
          return { part, body };
        };
        let group = startTable();
        for (const row of [...sourceTable.querySelectorAll("tbody > tr")]) {
          group.body.append(row);
          if (
            paper.scrollHeight > heightPx &&
            (group.body.children.length > 1 || paper.children.length > 1)
          ) {
            row.remove();
            if (!group.body.children.length) group.part.remove();
            await capture();
            group = startTable();
            group.body.append(row);
          }
        }
        continue;
      }
      paper.append(block);
      if (paper.scrollHeight > heightPx && paper.children.length > 1) {
        block.remove();
        await capture();
        paper.append(block);
      }
    }
    await capture();
    pdf.save(filename(settings.title, "pdf"));
  } finally {
    host.remove();
  }
}

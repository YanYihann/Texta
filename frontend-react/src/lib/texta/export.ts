import type { Article, NotebookEntry } from "./types";
import { highlights } from "./reading";

export interface ExportSource {
  article?: Article;
  entries?: NotebookEntry[];
}
export interface ExportSettings {
  title: string;
  includeChinese: boolean;
  margin: number;
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
      escape(text.slice(cursor, span.start)) +
      `<mark>${escape(text.slice(span.start, span.end))}</mark>`;
    cursor = span.end;
  }
  return html + escape(text.slice(cursor));
}
export const EXPORT_STYLE = `.texta-export-doc{color:#222724;background:#fff;font:16px/1.7 'Segoe UI','Microsoft YaHei',sans-serif;overflow-wrap:anywhere}.texta-export-doc h1{font:700 30px/1.25 Georgia,'Songti SC',serif;margin:0 0 24px}.texta-export-doc h2{font:700 24px/1.3 Georgia,serif;margin:0 0 6px}.texta-export-doc p{margin:0 0 12px}.texta-export-doc .en{font:20px/1.6 Georgia,'Songti SC',serif}.texta-export-doc .zh{font-size:15px;color:#505a51}.texta-export-doc mark{background:#dae8d4;color:#294e37;font-weight:700}.texta-export-doc .export-block{margin:0 0 20px;break-inside:avoid}.texta-export-doc .word-row{border-bottom:1px solid #d8ded7;padding-bottom:16px}.texta-export-doc small{font:13px/1.4 'Segoe UI','Microsoft YaHei',sans-serif;color:#606963}.texta-export-doc .mixed-word{display:inline-flex;flex-direction:column;text-align:center;vertical-align:baseline;margin:0 2px}.texta-export-doc .mixed-word small{margin-top:2px}.texta-export-doc .mixed{white-space:pre-wrap;font:20px/2 Georgia,'Songti SC',serif}`;
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
          paragraph += `<span class="mixed-word"><mark>${escape(run.text)}</mark>${settings.includeChinese ? `<small>${escape(run.pos)} ${escape(run.displayMeaning || run.meaning)}</small>` : ""}</span>`;
        else {
          const parts = run.text.split(/\n\s*\n/);
          for (let i = 0; i < parts.length; i++) {
            if (i) flush();
            paragraph += escape(parts[i]);
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
  } else
    for (const entry of source.entries || []) {
      blocks += `<section class="export-block word-row"><h2>${escape(entry.word)} <small>${escape(entry.pos)}</small></h2><p><small>US ${escape(entry.usIpa || entry.ipa || "—")} · UK ${escape(entry.ukIpa || entry.ipa || "—")}</small></p>${settings.includeChinese ? `<p>${entry.senses.map((sense) => escape(sense.meaning)).join("；")}</p>` : ""}<p>${(entry.collocations || []).map(escape).join("<br>")}</p>${settings.includeChinese && entry.wordFormation ? `<p><small>${escape(entry.wordFormation)}</small></p>` : ""}${entry.synonyms?.length ? `<p><small>Synonyms: ${entry.synonyms.map(escape).join(", ")}</small></p>` : ""}${entry.antonyms?.length ? `<p><small>Antonyms: ${entry.antonyms.map(escape).join(", ")}</small></p>` : ""}</section>`;
    }
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
    ...sourceElement.querySelectorAll<HTMLElement>(".export-block"),
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

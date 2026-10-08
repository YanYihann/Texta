"use client";
import { useState } from "react";
import {
  buildExportHtml,
  EXPORT_STYLE,
  exportPdf,
  exportWord,
  type ExportSource,
} from "@/lib/texta/export";
import { errorMessage } from "@/lib/texta/api";
import { Modal } from "./shared";
import { useText } from "./provider";

export function ExportDialog({
  source,
  format,
  onClose,
}: {
  source: ExportSource;
  format: "pdf" | "word";
  onClose: () => void;
}) {
  const { t } = useText();
  const [title, setTitle] = useState(source.article?.title || "Texta · 生词本"),
    [includeChinese, setIncludeChinese] = useState(true),
    [margin, setMargin] = useState(12);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const settings = { title, includeChinese, margin };
  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (format === "pdf") await exportPdf(source, settings);
      else exportWord(source, settings);
      onClose();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="导出前预览"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="export-preview-scroll">
        <label htmlFor="preview-title">{t("标题")}</label>
        <input
          id="preview-title"
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className="modal-row">
          <label className="quick-row">
            <input
              type="checkbox"
              checked={includeChinese}
              onChange={(event) => setIncludeChinese(event.target.checked)}
            />
            {t("包含中文翻译")}
          </label>
          <label>
            {t("页边距")}
            <select
              value={margin}
              onChange={(event) => setMargin(Number(event.target.value))}
            >
              <option value="8">{t("窄")}</option>
              <option value="12">{t("标准")}</option>
              <option value="16">{t("宽")}</option>
            </select>
          </label>
        </div>
        <style>{EXPORT_STYLE}</style>
        <div
          className="preview-paper"
          style={{ padding: `${margin}mm` }}
          dangerouslySetInnerHTML={{
            __html: buildExportHtml(source, settings),
          }}
        />
      </div>
      <p className="warning" role="status">
        {t(error)}
      </p>
      <div className="modal-actions">
        <button
          type="button"
          className="primary-btn"
          disabled={busy || !title.trim()}
          aria-busy={busy}
          onClick={() => void confirm()}
        >
          {t(busy ? "正在导出…" : "确认导出")}{" "}
          {format === "pdf" ? "PDF" : "Word"}
        </button>
      </div>
    </Modal>
  );
}

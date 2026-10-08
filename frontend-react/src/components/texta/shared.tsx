"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useText } from "./provider";

export function LanguageButton() {
  const { language, setLanguage } = useText();
  return (
    <button
      className="language-toggle"
      type="button"
      aria-label={language === "zh" ? "Switch to English" : "切换为中文"}
      onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
    >
      中文 / EN
    </button>
  );
}
export function Footer() {
  const { t } = useText();
  return (
    <footer className="policy-footer">
      <nav aria-label={t("网站政策")}>
        <Link href="/terms/">{t("服务条款")}</Link>
        <Link href="/privacy/">{t("隐私政策")}</Link>
        <Link href="/refund/">{t("退款政策")}</Link>
        <a href="mailto:1963372275@qq.com">{t("联系客服")}</a>
      </nav>
      <p>© 2026 Texta · {t("中国个人运营")} · 1963372275@qq.com</p>
    </footer>
  );
}
export function SimpleHeader({ children }: { children?: React.ReactNode }) {
  const { t } = useText();
  return (
    <header className="site-header">
      <Link className="wordmark" href="/app/" aria-label={t("Texta 主页")}>
        Texta
      </Link>
      <div className="header-tools">
        <LanguageButton />
        {children}
      </div>
    </header>
  );
}
export function Loading({
  error = "",
  retry,
}: {
  error?: string;
  retry?: () => void;
}) {
  const { t } = useText();
  return (
    <main className="connection-state-view" role="status">
      <p>{t(error || "正在连接账户…")}</p>
      {error && retry ? (
        <button type="button" onClick={retry}>
          {t("重试")}
        </button>
      ) : null}
    </main>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useText();
  useEffect(() => {
    const focus = document.activeElement as HTMLElement | null,
      dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      focus?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="react-dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="modal-card">
        <div className="modal-head">
          <h2 id="dialog-title">{t(title)}</h2>
          <button type="button" onClick={onClose} aria-label={t("关闭")}>
            {t("关闭")}
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

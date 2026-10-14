"use client";
import { useEffect, useRef, type RefObject } from "react";
import Link from "next/link";
import { useText } from "./provider";

export function useDismissPopover(ref: RefObject<HTMLDetailsElement | null>) {
  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    const outside = (event: Event) => {
      if (event.target instanceof Node && !details.contains(event.target))
        details.open = false;
    };
    const keyboard = (event: KeyboardEvent) => {
      const summary = details.querySelector("summary");
      if (event.key === "Escape" && details.open) {
        event.preventDefault();
        event.stopPropagation();
        details.open = false;
        summary?.focus();
      } else if (event.key === "ArrowDown" && event.target === summary) {
        event.preventDefault();
        details.open = true;
        details.querySelector<HTMLElement>("button, input, select, a")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    details.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      details.removeEventListener("keydown", keyboard);
    };
  }, [ref]);
}

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
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
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
      className={`react-dialog ${className}`}
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

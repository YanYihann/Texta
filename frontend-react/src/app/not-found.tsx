"use client";
import Link from "next/link";
import { PageFrame, useText } from "@/components/texta/provider";
export default function NotFound() {
  const { t } = useText();
  return (
    <PageFrame title="页面不存在">
      <main className="connection-state-view">
        <h1>404 · {t("页面不存在")}</h1>
        <Link href="/app/">{t("返回学习")}</Link>
      </main>
    </PageFrame>
  );
}

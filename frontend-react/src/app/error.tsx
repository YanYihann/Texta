"use client";
import { PageFrame, useText } from "@/components/texta/provider";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useText();
  return (
    <PageFrame title="页面暂时无法显示">
      <main className="connection-state-view">
        <h1>{t("页面暂时无法显示")}</h1>
        <p>{t("请重试。已保存的学习资料会继续保留。")}</p>
        <button type="button" onClick={reset}>
          {t("重试")}
        </button>
      </main>
    </PageFrame>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, errorMessage } from "@/lib/texta/api";
import { TOKEN_KEY, writeStorage } from "@/lib/texta/storage";
import { PageFrame, useSession, useText } from "./provider";
import { Footer, LanguageButton, Modal } from "./shared";

export function AuthPage() {
  const router = useRouter();
  const { user, ready, error: connectionError, retry } = useSession();
  const { t } = useText();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false),
    [help, setHelp] = useState(false);
  useEffect(() => {
    if (ready && user) router.replace("/app/");
  }, [ready, user, router]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ token: string }>(
        register ? "/api/auth/register" : "/api/auth/login",
        {
          method: "POST",
          token: "",
          timeoutMs: 45000,
          body: {
            email: String(form.get("email") || "").trim(),
            password: form.get("password"),
            ...(register ? { name: form.get("name") } : {}),
          },
        },
      );
      if (!result.token) throw Error("Missing session token");
      writeStorage(TOKEN_KEY, result.token);
      await retry();
      router.replace("/app/");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageFrame kind="auth" title={register ? "注册" : "登录"}>
      <header className="site-header">
        <Link href="/" className="wordmark">
          Texta
        </Link>
        <div className="header-tools">
          <LanguageButton />
          <button id="authHelpBtn" type="button" onClick={() => setHelp(true)}>
            {t("帮助")}
          </button>
        </div>
      </header>
      <main className="auth-page-wrap">
        <section className="auth-card">
          <h1>{t(register ? "注册 Texta" : "登录 Texta")}</h1>
          <div className="auth-tabs" role="tablist" aria-label={t("账户操作")}>
            {[false, true].map((value) => (
              <button
                key={String(value)}
                id={value ? "register-tab" : "login-tab"}
                className={`auth-tab ${register === value ? "active" : ""}`}
                role="tab"
                type="button"
                aria-selected={register === value}
                aria-controls="auth-form"
                tabIndex={register === value ? 0 : -1}
                onKeyDown={(event) => {
                  if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  ) {
                    event.preventDefault();
                    const next =
                      event.key === "Home"
                        ? false
                        : event.key === "End"
                          ? true
                          : !register;
                    setRegister(next);
                    setMessage("");
                    document
                      .getElementById(next ? "register-tab" : "login-tab")
                      ?.focus();
                  }
                }}
                onClick={() => {
                  setRegister(value);
                  setMessage("");
                }}
              >
                {t(value ? "注册" : "登录")}
              </button>
            ))}
          </div>
          <p className="auth-msg" role="status" aria-live="polite">
            {t(message || connectionError)}
          </p>
          {connectionError ? (
            <button type="button" onClick={() => void retry()}>
              {t("重试")}
            </button>
          ) : null}
          <form
            id="auth-form"
            className="auth-form"
            role="tabpanel"
            aria-labelledby={register ? "register-tab" : "login-tab"}
            onSubmit={submit}
          >
            {register ? (
              <>
                <label htmlFor="auth-name">{t("用户名")}</label>
                <input
                  id="auth-name"
                  name="name"
                  maxLength={60}
                  autoComplete="nickname"
                  placeholder={t("请输入你的用户名")}
                />
              </>
            ) : null}
            <label htmlFor="auth-email">{t("邮箱")}</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder="example@email.com"
            />
            <div className="auth-label-row">
              <label htmlFor="auth-password">{t("密码")}</label>
              {!register ? (
                <button
                  className="text-btn"
                  type="button"
                  onClick={() =>
                    setMessage(
                      "请联系客服协助恢复账号，当前未开放自助密码重置。",
                    )
                  }
                >
                  {t("忘记密码？")}
                </button>
              ) : null}
            </div>
            <div className="password-field">
              <input
                id="auth-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={register ? 6 : undefined}
                autoComplete={register ? "new-password" : "current-password"}
                placeholder={t(register ? "至少 6 位密码" : "请输入密码")}
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={t(showPassword ? "隐藏密码" : "显示密码")}
                aria-pressed={showPassword}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12c3-5 6-7 10-7s7 2 10 7c-3 5-6 7-10 7S5 17 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
            {register ? (
              <p className="auth-policy-note">
                {t("注册前请阅读")} <a href="/terms/">{t("服务条款")}</a>{" "}
                {t("及")} <a href="/privacy/">{t("隐私政策")}</a>
                {t(
                  "。注册即表示同意服务条款；需单独同意的数据处理会另行说明。",
                )}
              </p>
            ) : null}
            <button
              className="primary-btn"
              type="submit"
              disabled={busy}
              aria-busy={busy}
            >
              {t(busy ? "正在连接…" : register ? "注册并进入" : "登录并进入")}
            </button>
          </form>
        </section>
      </main>
      <Footer />
      {help ? (
        <Modal title="Texta 使用说明" onClose={() => setHelp(false)}>
          <p>
            {t(
              "将英语词汇变成双语学习文章，结合词汇解释、收藏夹与生词本，帮助你积累和复习。",
            )}
          </p>
          <p>
            <a href="mailto:1963372275@qq.com">{t("联系客服")}</a>
          </p>
        </Modal>
      ) : null}
    </PageFrame>
  );
}

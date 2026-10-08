"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/texta/api";
import { id } from "@/lib/texta/library";
import { readStorage, TOKEN_KEY, writeStorage } from "@/lib/texta/storage";
import type { BillingProduct, PaymentOrder } from "@/lib/texta/types";
import { PageFrame, usePreference, useSession, useText } from "./provider";
import { Footer, Loading, Modal, SimpleHeader } from "./shared";
const rank: Record<string, number> = { free: 0, plus: 1, pro: 2 };
function checkout(url?: string) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      (parsed.hostname === "onfastspring.com" ||
        parsed.hostname.endsWith(".onfastspring.com") ||
        parsed.hostname.endsWith(".fastspring.com"))
      ? parsed.href
      : "";
  } catch {
    return "";
  }
}
export function BillingPage() {
  const { user } = useSession();
  return <BillingContent key={user?.id || "guest"} />;
}
function BillingContent() {
  const { t } = useText(),
    session = useSession();
  const { refreshUsage } = session;
  const [products, setProducts] = useState<BillingProduct[]>([]),
    [available, setAvailable] = useState(false),
    [loaded, setLoaded] = useState(false),
    [message, setMessage] = useState("");
  const [term, setTerm] = useState("monthly"),
    [selected, setSelected] = useState<BillingProduct | null>(null),
    [order, setOrder] = useState<PaymentOrder | null>(null),
    [showOrder, setShowOrder] = useState(false),
    [busy, setBusy] = useState(false);
  const requestKey = useRef(""),
    popup = useRef<Window | null>(null),
    polling = useRef(false),
    serial = useRef(0),
    orderKey = session.user ? `texta_pending_payment_${session.user.id}` : "";
  const [pendingId] = usePreference(
    orderKey || "texta_pending_payment_guest",
    "",
  );
  const load = useCallback(
    () =>
      api<{ products: BillingProduct[]; paymentsAvailable: boolean }>(
        "/api/billing/plans",
      )
        .then((result) => {
          setProducts(result.products);
          setAvailable(result.paymentsAvailable === true);
          setLoaded(true);
          setMessage("");
        })
        .catch((error) => setMessage(errorMessage(error))),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!showOrder || !order?.id || !orderKey) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (stopped || polling.current) return;
      if (document.visibilityState !== "visible") {
        timer = setTimeout(poll, 3500);
        return;
      }
      polling.current = true;
      const token = readStorage(TOKEN_KEY);
      try {
        const result = await api<{ order: PaymentOrder }>(
          `/api/billing/orders/${encodeURIComponent(order.id)}`,
          { token: token || "" },
        );
        if (stopped || token !== readStorage(TOKEN_KEY)) return;
        setOrder(result.order);
        if (result.order.status === "paid") {
          writeStorage(orderKey, null);
          writeStorage("texta_plan_updated", String(Date.now()));
          setShowOrder(false);
          popup.current?.close();
          setMessage("支付成功，套餐已生效。");
          void refreshUsage();
          return;
        }
        setMessage(
          result.order.status === "expired"
            ? "订单已过期。如已支付，系统仍会核对到账结果。"
            : "正在等待到账确认…",
        );
      } catch {
        if (!stopped) setMessage("暂时无法查询付款结果，将继续重试。");
      } finally {
        polling.current = false;
        if (!stopped)
          timer = setTimeout(poll, order.status === "expired" ? 15000 : 3500);
      }
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [showOrder, order?.id, order?.status, orderKey, refreshUsage]);
  async function purchase() {
    if (!selected || busy) return;
    setBusy(true);
    const attempt = ++serial.current,
      token = readStorage(TOKEN_KEY);
    popup.current = window.open(
      "about:blank",
      "_blank",
      "popup,width=520,height=760",
    );
    if (popup.current) popup.current.opener = null;
    try {
      const result = await api<{ order: PaymentOrder }>("/api/billing/orders", {
        method: "POST",
        token: token || "",
        body: { product: selected.id, requestKey: requestKey.current },
      });
      if (attempt !== serial.current || token !== readStorage(TOKEN_KEY))
        return;
      const url = checkout(result.order.checkoutUrl);
      if (url && popup.current) popup.current.location.href = url;
      else popup.current?.close();
      writeStorage(orderKey, result.order.id);
      setOrder(result.order);
      setSelected(null);
      setShowOrder(true);
    } catch (error) {
      popup.current?.close();
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function resume() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api<{ order: PaymentOrder }>(
        `/api/billing/orders/${encodeURIComponent(pendingId)}`,
      );
      setOrder(result.order);
      setShowOrder(true);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  useEffect(
    () => () => {
      serial.current++;
    },
    [],
  );
  return (
    <PageFrame kind="billing" title="Plus / Pro 套餐">
      <SimpleHeader>
        <Link href="/app/">{t("返回学习")}</Link>
      </SimpleHeader>
      <main className="billing-shell">
        <header className="billing-heading">
          <h1>{t("选择适合你的学习套餐")}</h1>
          <p>
            {t("当前套餐")}: {session.user?.plan || "—"}
            {session.user?.planExpiresAt
              ? ` · ${new Date(session.user.planExpiresAt).toLocaleDateString()}`
              : ""}
          </p>
          <p role="status">
            {t(
              available
                ? "通过 FastSpring 安全支付，到账后自动开通。"
                : "购买暂未开放，支付服务正在准备中。",
            )}
          </p>
        </header>
        {session.error ? (
          <Loading error={session.error} retry={session.retry} />
        ) : null}
        <div
          className="billing-term-toggle"
          role="group"
          aria-label={t("套餐期限")}
        >
          {["monthly", "lifetime"].map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={term === value}
              onClick={() => setTerm(value)}
            >
              {t(value === "monthly" ? "按月套餐" : "永久套餐")}
            </button>
          ))}
        </div>
        <p>
          {t(
            term === "monthly"
              ? "按月套餐为一次性购买，到期不会自动扣款。"
              : "永久套餐一次性支付，无需按月续费。",
          )}
        </p>
        <div className="plan-grid">
          {["free", "plus", "pro"].map((plan) => {
            const product = products.find(
                (row) => row.plan === plan && row.term === term,
              ),
              owned = Boolean(
                session.user &&
                (session.user.role === "admin" ||
                  rank[session.user.permanentPlan || "free"] >= rank[plan]),
              ),
              lower = Boolean(
                session.user && rank[session.user.plan] > rank[plan],
              );
            return (
              <article
                className={`plan-card ${plan === "plus" ? "featured" : ""}`}
                key={plan}
              >
                <h2>
                  {plan === "free" ? "Free" : plan === "plus" ? "Plus" : "Pro"}
                </h2>
                <p className="plan-price">
                  ¥
                  {plan === "free"
                    ? "0"
                    : product
                      ? (product.amountFen / 100).toFixed(2)
                      : "—"}
                  <span>{t(term === "monthly" ? "/ 月" : "一次支付")}</span>
                </p>
                <p>
                  {product?.dailyCredits ??
                    (plan === "free" ? 10 : plan === "plus" ? 50 : 150)}{" "}
                  {t("每日积分")}
                </p>
                <ul>
                  <li>{t("文章生成与完整词汇解析")}</li>
                  <li>{t("收藏夹与生词本云端同步")}</li>
                  <li>{t("PDF / Word 导出")}</li>
                </ul>
                {plan === "free" ? (
                  <Link
                    className="primary-btn"
                    href={session.user ? "/app/" : "/"}
                  >
                    {t(session.user ? "返回学习" : "登录 / 注册")}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={
                      !loaded ||
                      !available ||
                      !session.user ||
                      owned ||
                      lower ||
                      !product
                    }
                    onClick={() => {
                      if (product) {
                        requestKey.current = id();
                        setMessage("");
                        setSelected(product);
                      }
                    }}
                  >
                    {t(
                      owned
                        ? "已拥有"
                        : lower
                          ? "当前套餐等级更高"
                          : !available
                            ? "即将开放"
                            : !session.user
                              ? "请先登录"
                              : session.user.plan === plan && term === "monthly"
                                ? "续费套餐"
                                : "选择套餐",
                    )}
                  </button>
                )}
              </article>
            );
          })}
        </div>
        <p role="status" className="warning">
          {t(message)}
        </p>
        {!loaded ? (
          <button type="button" onClick={() => void load()}>
            {t("重试")}
          </button>
        ) : null}
        {pendingId ? (
          <button type="button" disabled={busy} onClick={() => void resume()}>
            {t("继续查询未完成订单")}
          </button>
        ) : null}
        <p>
          {t(
            "积分每天重置，不累计。升级至 Pro 立即生效，原 Plus 剩余时间不折抵。",
          )}
        </p>
        <p>
          <Link href="/refund/">{t("查看退款政策")}</Link>
        </p>
      </main>
      <Footer />
      {selected ? (
        <Modal
          title="确认套餐"
          onClose={() => {
            if (!busy) setSelected(null);
          }}
        >
          <p>
            {t(selected.name)} · ¥{(selected.amountFen / 100).toFixed(2)}
          </p>
          <p>
            {t(
              term === "monthly"
                ? "购买后生效一个月，同套餐续费顺延，到期不自动扣款。"
                : "一次购买，永久有效。每天积分重置，不累计。",
            )}
          </p>
          <p role="status">{t(message)}</p>
          <button
            type="button"
            disabled={busy}
            aria-busy={busy}
            className="primary-btn"
            onClick={() => void purchase()}
          >
            {t(busy ? "正在创建订单…" : "前往安全支付")}
          </button>
        </Modal>
      ) : null}
      {showOrder && order ? (
        <Modal title="等待支付确认" onClose={() => setShowOrder(false)}>
          <p>
            {t(
              products.find((row) => row.id === order.product)?.name ||
                order.product,
            )}{" "}
            · ¥{(order.amountFen / 100).toFixed(2)}
          </p>
          <p role="status">{t(message)}</p>
          <p>
            {t("订单有效期")}: {new Date(order.expiresAt).toLocaleString()}
          </p>
          <button
            type="button"
            disabled={
              !checkout(order.checkoutUrl) || order.status !== "pending"
            }
            onClick={() => {
              popup.current = window.open(
                checkout(order.checkoutUrl),
                "_blank",
                "popup,width=520,height=760",
              );
              if (popup.current) popup.current.opener = null;
            }}
          >
            {t("重新打开支付页面")}
          </button>
          <p>{t("完成付款后会自动核对到账；关闭窗口后仍可继续查询。")}</p>
        </Modal>
      ) : null}
    </PageFrame>
  );
}

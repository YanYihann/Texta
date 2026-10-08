"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/texta/api";
import type { User } from "@/lib/texta/types";
import { PageFrame, useSession, useText } from "./provider";
import { Footer, Loading, Modal, SimpleHeader } from "./shared";
interface UsageUser extends User {
  totalUsage: number;
  detailedUsageCount?: number;
  legacyUsageCount?: number;
  latestUsedAt?: string;
  dailyUsage?: { dateKey: string; count: number }[];
  hourlyUsage?: { hourLabel: string; count: number }[];
  recentPeriods?: {
    periodLabel: string;
    count: number;
    latestUsedAt: string;
  }[];
}
interface Review {
  id: string;
  userEmail: string;
  payerName: string;
  amount: string;
  createdAt: string;
  proofCode: string;
  proofImageUrl: string;
  note: string;
}
const safeLink = (url: string) => (/^https?:\/\//i.test(url) ? url : "");
export function AdminPage({ view }: { view: "reviews" | "usage" | "detail" }) {
  const session = useSession(),
    router = useRouter(),
    { t } = useText();
  useEffect(() => {
    if (session.ready && !session.error && !session.user) router.replace("/");
  }, [session.ready, session.error, session.user, router]);
  return (
    <PageFrame kind="admin" title="管理后台">
      <SimpleHeader>
        <Link href="/app/">{t("返回学习")}</Link>
      </SimpleHeader>
      {!session.ready || session.error || !session.user ? (
        <Loading error={session.error} retry={session.retry} />
      ) : session.user.role !== "admin" ? (
        <main className="admin-shell">
          <h1>{t("无权访问")}</h1>
          <Link href="/app/">{t("返回学习")}</Link>
        </main>
      ) : (
        <AdminContent key={session.user.id} view={view} />
      )}
      <Footer />
    </PageFrame>
  );
}
function AdminContent({ view }: { view: "reviews" | "usage" | "detail" }) {
  const { t } = useText(),
    [users, setUsers] = useState<UsageUser[]>([]),
    [reviews, setReviews] = useState<Review[]>([]),
    [detail, setDetail] = useState<UsageUser | null>(null);
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("pending"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [operation, setOperation] = useState<{
      user?: UsageUser;
      review?: Review;
      action?: "approve" | "reject";
    } | null>(null),
    serial = useRef(0);
  const load = useCallback(async () => {
    const attempt = ++serial.current;
    setBusy(true);
    setError("");
    try {
      if (view === "reviews") {
        const result = await api<{ items: Review[] }>(
          `/api/admin/vip-requests?status=${status}`,
        );
        if (attempt === serial.current) setReviews(result.items);
      } else if (view === "usage") {
        const result = await api<{ items: UsageUser[] }>(
          "/api/admin/usage-overview",
        );
        if (attempt === serial.current) setUsers(result.items);
      } else {
        const userId = new URLSearchParams(location.search).get("userId");
        if (!userId) throw Error("缺少用户编号。");
        const result = await api<{ item: UsageUser }>(
          `/api/admin/usage-users/${encodeURIComponent(userId)}/detail`,
        );
        if (attempt === serial.current) setDetail(result.item);
      }
    } catch (error) {
      if (attempt === serial.current) setError(errorMessage(error));
    } finally {
      if (attempt === serial.current) setBusy(false);
    }
  }, [view, status]);
  // Start the external API request on mount/filter change and invalidate the latest sequence at cleanup.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      serial.current++;
    };
  }, [load]);
  async function confirm(form: HTMLFormElement) {
    if (!operation || busy) return;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    try {
      if (operation.user)
        await api(
          `/api/admin/users/${encodeURIComponent(operation.user.id)}/plan`,
          {
            method: "POST",
            body: { plan: values.get("plan"), term: values.get("term") },
          },
        );
      else if (operation.review)
        await api(
          `/api/admin/vip-requests/${encodeURIComponent(operation.review.id)}/${operation.action}`,
          {
            method: "POST",
            body: { reviewNote: String(values.get("note") || "") },
          },
        );
      setOperation(null);
      await load();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const filtered = users
    .filter((user) =>
      `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => b.totalUsage - a.totalUsage);
  return (
    <main className="admin-shell">
      <nav className="admin-navigation">
        <Link href="/admin/">{t("历史充值审核")}</Link>
        <Link href="/admin-usage/">{t("用户使用查看")}</Link>
      </nav>
      <div className="section-heading">
        <h1>
          {t(
            view === "reviews"
              ? "历史充值审核"
              : view === "usage"
                ? "用户使用查看"
                : "用户使用详情",
          )}
        </h1>
        <button type="button" disabled={busy} onClick={() => void load()}>
          {t(busy ? "正在加载…" : "刷新")}
        </button>
      </div>
      <p role="status" className="warning">
        {t(error)}
      </p>
      {view === "reviews" ? (
        <>
          <select
            aria-label={t("审核状态")}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {["pending", "approved", "rejected"].map((value) => (
              <option value={value} key={value}>
                {t(
                  { pending: "待审核", approved: "已通过", rejected: "已驳回" }[
                    value
                  ]!,
                )}
              </option>
            ))}
          </select>
          {reviews.length ? (
            reviews.map((review) => (
              <article className="fav-item" key={review.id}>
                <h2>{review.userEmail}</h2>
                <p>
                  {review.payerName} · ¥{review.amount} ·{" "}
                  {new Date(review.createdAt).toLocaleString()}
                </p>
                <p>
                  {t("凭证号")}: {review.proofCode || "—"}
                </p>
                {safeLink(review.proofImageUrl) ? (
                  <a
                    href={safeLink(review.proofImageUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("查看凭证图")}
                  </a>
                ) : null}
                <p>{review.note}</p>
                {status === "pending" ? (
                  <div className="actions">
                    {(["approve", "reject"] as const).map((action) => (
                      <button
                        type="button"
                        key={action}
                        disabled={busy}
                        onClick={() => setOperation({ review, action })}
                      >
                        {t(action === "approve" ? "通过" : "驳回")}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <p>{t("暂无审核记录")}</p>
          )}
        </>
      ) : view === "usage" ? (
        <>
          <label htmlFor="admin-search">{t("搜索用户")}</label>
          <input
            type="search"
            id="admin-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <p>
            {filtered.length} {t("位用户")} · {t("总使用次数")}:{" "}
            {filtered.reduce((sum, row) => sum + row.totalUsage, 0)}
          </p>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  {["用户", "套餐", "总使用次数", "最近使用", "操作"].map(
                    (text) => (
                      <th key={text} scope="col">
                        {t(text)}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id}>
                    <th scope="row">
                      <Link
                        href={`/admin-usage-detail/?userId=${encodeURIComponent(user.id)}`}
                      >
                        {user.name || user.email}
                      </Link>
                      <small>{user.email}</small>
                    </th>
                    <td>
                      {user.plan}
                      {user.permanentPlan === user.plan && user.plan !== "free"
                        ? ` · ${t("永久")}`
                        : ""}
                      <small>
                        {user.planExpiresAt
                          ? new Date(user.planExpiresAt).toLocaleDateString()
                          : ""}
                      </small>
                    </td>
                    <td>{user.totalUsage}</td>
                    <td>
                      {user.latestUsedAt
                        ? new Date(user.latestUsedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={user.role === "admin" || busy}
                        onClick={() => setOperation({ user })}
                      >
                        {t("修改套餐")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : detail ? (
        <>
          <h2>{detail.name || detail.email}</h2>
          <p>
            {detail.email} · {detail.plan} · {t("总使用次数")}:{" "}
            {detail.totalUsage}
          </p>
          <h3>{t("最近 30 天")}</h3>
          <UsageChart
            rows={(detail.dailyUsage || [])
              .slice(-30)
              .map((row) => ({ label: row.dateKey, count: row.count }))}
          />
          <h3>{t("各时段使用分布")}</h3>
          <UsageChart
            rows={(detail.hourlyUsage || []).map((row) => ({
              label: row.hourLabel,
              count: row.count,
            }))}
          />
          {detail.recentPeriods?.length ? (
            <>
              <h3>{t("近期使用记录")}</h3>
              <ul>
                {detail.recentPeriods.map((row) => (
                  <li key={row.periodLabel}>
                    {row.periodLabel} · {row.count} ·{" "}
                    {new Date(row.latestUsedAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
      {operation ? (
        <Modal
          title={operation.user ? "修改套餐" : "确认审核"}
          onClose={() => {
            if (!busy) setOperation(null);
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void confirm(event.currentTarget);
            }}
          >
            <p>{operation.user?.email || operation.review?.userEmail}</p>
            {operation.user ? (
              <>
                <label>
                  {t("套餐")}
                  <select name="plan" defaultValue={operation.user.plan}>
                    {["free", "plus", "pro"].map((plan) => (
                      <option key={plan}>{plan}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("期限")}
                  <select name="term">
                    <option value="monthly">{t("一个月")}</option>
                    <option value="lifetime">{t("永久")}</option>
                  </select>
                </label>
                <p>{t("修改为 Free 将清除当前付费期限及永久权益。")}</p>
              </>
            ) : (
              <>
                <p>
                  {t(
                    operation.action === "approve"
                      ? "确认通过这笔历史充值申请？"
                      : "确认驳回这笔历史充值申请？",
                  )}
                </p>
                <label htmlFor="review-note">{t("审核备注")}</label>
                <textarea
                  id="review-note"
                  name="note"
                  maxLength={500}
                  required={operation.action === "reject"}
                />
              </>
            )}
            <p role="status" className="warning">
              {t(error)}
            </p>
            <button type="submit" className="primary-btn" disabled={busy}>
              {t(busy ? "正在保存…" : "确认")}
            </button>
          </form>
        </Modal>
      ) : null}
    </main>
  );
}
function UsageChart({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="usage-chart">
      {rows.map((row) => (
        <div className="usage-chart-row" key={row.label}>
          <span>{row.label}</span>
          <span className="usage-chart-track">
            <span style={{ width: `${(row.count / max) * 100}%` }} />
          </span>
          <strong>{row.count}</strong>
        </div>
      ))}
    </div>
  );
}

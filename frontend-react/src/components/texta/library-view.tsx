"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import { id, type LibraryStore } from "@/lib/texta/library";
import type { Article, Folder } from "@/lib/texta/types";
import { useText } from "./provider";
import { Modal } from "./shared";

type Operation =
  | { type: "create" | "rename-folder" | "delete-folder"; folder?: Folder }
  | { type: "rename-article" | "delete-article"; article: Article };
export function LibraryView({
  store,
  history,
  mode,
  onOpen,
  onDeleteHistory,
}: {
  store: LibraryStore;
  history: Article[];
  mode: "favorites" | "history";
  onOpen: (article: Article) => void;
  onDeleteHistory: (id: string) => void;
}) {
  const { library } = useSyncExternalStore(
      store.subscribe,
      store.getSnapshot,
      store.getServerSnapshot,
    ),
    { t } = useText();
  const [search, setSearch] = useState(""),
    [sort, setSort] = useState("az"),
    [folder, setFolder] = useState("all"),
    [operation, setOperation] = useState<Operation | null>(null);
  const [message, setMessage] = useState("");
  const folders = library.libraryFolders.filter((row) => !row.deletedAt);
  const rows = useMemo(
    () =>
      (mode === "favorites" ? library.favorites : history)
        .filter(
          (row) =>
            !row.deletedAt &&
            (mode === "history" ||
              folder === "all" ||
              row.folderId === folder) &&
            `${row.title} ${row.article} ${row.words.join(" ")}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "az"
            ? a.title.localeCompare(b.title)
            : (sort === "oldest" ? 1 : -1) *
              a.createdAt.localeCompare(b.createdAt),
        ),
    [library.favorites, history, mode, folder, search, sort],
  );
  function move(article: Article, folderId: string) {
    store.change((current) => ({
      ...current,
      favorites: current.favorites.map((row) =>
        row.id === article.id
          ? { ...row, folderId, updatedAt: new Date().toISOString() }
          : row,
      ),
    }));
  }
  function confirm(name = "") {
    if (!operation) return;
    const now = new Date().toISOString();
    if (operation.type === "create") {
      if (library.libraryFolders.length >= 200) {
        setMessage("文件夹数量已达到上限。");
        return;
      }
      store.change((current) => ({
        ...current,
        libraryFolders: [
          ...current.libraryFolders,
          { id: id(), name, createdAt: now, updatedAt: now, deletedAt: "" },
        ],
      }));
    } else if (operation.type === "rename-folder") {
      store.change((current) => ({
        ...current,
        libraryFolders: current.libraryFolders.map((row) =>
          row.id === operation.folder?.id
            ? { ...row, name, updatedAt: now }
            : row,
        ),
      }));
    } else if (operation.type === "delete-folder") {
      store.change((current) => ({
        ...current,
        libraryFolders: current.libraryFolders.map((row) =>
          row.id === operation.folder?.id
            ? { ...row, deletedAt: now, updatedAt: now }
            : row,
        ),
        favorites: current.favorites.map((row) =>
          row.folderId === operation.folder?.id
            ? { ...row, folderId: "", updatedAt: now }
            : row,
        ),
      }));
      setFolder("all");
    } else if (operation.type === "rename-article") {
      store.change((current) => ({
        ...current,
        favorites: current.favorites.map((row) =>
          row.id === operation.article.id
            ? { ...row, title: name, updatedAt: now }
            : row,
        ),
      }));
    } else if ("article" in operation) {
      if (mode === "history") onDeleteHistory(operation.article.id);
      else
        store.change((current) => ({
          ...current,
          favorites: current.favorites.map((row) =>
            row.id === operation.article.id
              ? { ...row, deletedAt: now, updatedAt: now }
              : row,
          ),
        }));
    }
    setOperation(null);
  }
  const selectedFolder = folders.find((row) => row.id === folder);
  return (
    <section className="library-panel">
      <div className="section-heading">
        <h2>{t(mode === "favorites" ? "收藏夹" : "历史记录")}</h2>
        <span>
          {rows.length} {t("篇文章")}
        </span>
      </div>
      <div className="library-controls">
        <div className="library-search-row">
          <input
            type="search"
            aria-label={t("搜索收藏文章")}
            placeholder={t("搜索标题、文章或词汇")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            aria-label={t("收藏排序")}
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="az">{t("A–Z 字母排序")}</option>
            <option value="newest">{t("加入时间 · 最新在前")}</option>
            <option value="oldest">{t("加入时间 · 最早在前")}</option>
          </select>
        </div>
        {mode === "favorites" ? (
          <div className="folder-toolbar">
            <select
              aria-label={t("选择文件夹")}
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
            >
              <option value="all">{t("全部文章")}</option>
              <option value="">{t("未分类")}</option>
              {folders.map((row) => (
                <option value={row.id} key={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setOperation({ type: "create" })}
            >
              {t("新建文件夹")}
            </button>
            <button
              type="button"
              disabled={!selectedFolder}
              onClick={() =>
                setOperation({ type: "rename-folder", folder: selectedFolder })
              }
            >
              {t("重命名")}
            </button>
            <button
              type="button"
              disabled={!selectedFolder}
              onClick={() =>
                setOperation({ type: "delete-folder", folder: selectedFolder })
              }
            >
              {t("删除文件夹")}
            </button>
          </div>
        ) : null}
      </div>
      <p role="status">{t(message)}</p>
      <div className="favorites-list">
        {rows.length ? (
          rows.map((article) => (
            <article className="fav-item" key={article.id}>
              <button
                className="article-open-button"
                type="button"
                onClick={() => onOpen(article)}
              >
                <strong className="fav-title">{article.title}</strong>
                <span className="fav-meta">
                  {article.words.length} {t("个单词")} ·{" "}
                  {new Date(article.createdAt).toLocaleDateString()} ·{" "}
                  {t(
                    article.generationMode === "mixed"
                      ? "中英混合"
                      : "双语文章",
                  )}
                </span>
                <span className="fav-preview">
                  {article.article.slice(0, 150)}
                </span>
              </button>
              <div className="fav-actions">
                {mode === "favorites" ? (
                  <>
                    <select
                      aria-label={`${t("移动到文件夹")}: ${article.title}`}
                      value={article.folderId || ""}
                      onChange={(event) => move(article, event.target.value)}
                    >
                      <option value="">{t("未分类")}</option>
                      {folders.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`${t("重命名")}: ${article.title}`}
                      onClick={() =>
                        setOperation({ type: "rename-article", article })
                      }
                    >
                      {t("重命名")}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  aria-label={`${t("删除")}: ${article.title}`}
                  onClick={() =>
                    setOperation({ type: "delete-article", article })
                  }
                >
                  {t("删除")}
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="empty-library">
            {t(mode === "favorites" ? "暂无收藏文章" : "暂无历史记录")}
          </p>
        )}
      </div>
      {operation ? (
        <Modal
          title={
            operation.type.startsWith("delete")
              ? "确认删除"
              : operation.type === "create"
                ? "新建文件夹"
                : "重命名"
          }
          onClose={() => setOperation(null)}
        >
          {operation.type.startsWith("delete") ? (
            <>
              <p>
                {t(
                  operation.type === "delete-folder"
                    ? "删除文件夹后，文章将保留在未分类中。"
                    : "确定删除这篇文章？",
                )}
              </p>
              <button
                type="button"
                className="primary-btn"
                onClick={() => confirm()}
              >
                {t("确认删除")}
              </button>
            </>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const name = String(
                  new FormData(event.currentTarget).get("name") || "",
                ).trim();
                if (name) confirm(name);
              }}
            >
              <label htmlFor="item-name">{t("名称")}</label>
              <input
                id="item-name"
                name="name"
                defaultValue={
                  "article" in operation
                    ? operation.article.title
                    : operation.folder?.name || ""
                }
                maxLength={"article" in operation ? 200 : 80}
                required
                autoFocus
              />
              <div className="modal-actions">
                <button type="submit" className="primary-btn">
                  {t("保存")}
                </button>
              </div>
            </form>
          )}
        </Modal>
      ) : null}
    </section>
  );
}

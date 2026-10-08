const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  LibraryStore,
  emptyLibrary,
  normalizeArticle,
  mergeLibrary,
  addNotebook,
} = require("../../output/frontend-domain/library.js");
const {
  highlights,
  articleContext,
  hydrateLexicon,
} = require("../../output/frontend-domain/reading.js");
const {
  splitWords,
  importWords,
} = require("../../output/frontend-domain/words.js");
const { buildExportHtml } = require("../../output/frontend-domain/export.js");
const values = new Map();
global.window = new EventTarget();
window.localStorage = global.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
window.dispatchEvent = window.dispatchEvent.bind(window);
global.CustomEvent ||= class extends Event {
  constructor(type, options) {
    super(type);
    this.detail = options?.detail;
  }
};
const reply = (data) =>
  new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
const stamp = "2026-10-01T00:00:00.000Z";
const card = {
  word: "resilient",
  senses: [{ meaning: "有韧性的" }],
  usIpa: "/rɪˈzɪliənt/",
  ukIpa: "/rɪˈzɪliənt/",
  collocations: ["a resilient community"],
  detailsReady: true,
};
const article = () =>
  normalizeArticle({
    id: "article-1",
    title: "Read safely",
    article: "A resilient community thrives.",
    words: ["resilient"],
    lexicon: [card],
    createdAt: stamp,
    updatedAt: stamp,
    generationMode: "standard",
    paragraphsEn: ["A resilient community thrives."],
    paragraphsZh: ["一个有韧性的社区蓬勃发展。"],
    alignment: [
      {
        word: "resilient",
        occurrences: [
          {
            paragraph: 0,
            sentence: 0,
            enStart: 2,
            enEnd: 11,
            zhStart: 2,
            zhEnd: 6,
          },
        ],
      },
    ],
    sentencePairs: [
      {
        paragraph: 0,
        en: "A resilient community thrives.",
        zh: "一个有韧性的社区蓬勃发展。",
      },
    ],
  });
function setup(user = "one") {
  values.clear();
  values.set("texta_auth_token", user);
}
test("legacy browser data imports once and stays isolated across accounts", () => {
  setup();
  values.set("texta_favorites_v1", JSON.stringify([article()]));
  const first = new LibraryStore("one", "one");
  assert.equal(first.getSnapshot().library.favorites.length, 1);
  first.dispose();
  values.set("texta_auth_token", "two");
  const second = new LibraryStore("two", "two");
  assert.equal(second.getSnapshot().library.favorites.length, 0);
  second.dispose();
  values.set("texta_auth_token", "one");
  values.set("texta_next_library_v1_one", JSON.stringify(emptyLibrary()));
  const reload = new LibraryStore("one", "one");
  assert.equal(reload.getSnapshot().library.favorites.length, 0);
  reload.dispose();
});
test("unavailable initial cloud read cannot overwrite cloud data with a local snapshot", async () => {
  setup();
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push(options?.method || "GET");
    return new Response(JSON.stringify({ error: "unavailable" }), {
      status: 503,
    });
  };
  const store = new LibraryStore("one", "one");
  store.change((library) => ({ ...library, favorites: [article()] }));
  await store.flush();
  assert.equal(store.getSnapshot().status, "offline");
  assert.ok(calls.every((method) => method === "GET"));
  assert.equal(store.getSnapshot().library.favorites.length, 1);
  store.dispose();
});
test("local changes made during hydration and an upload are included in the next serialized upload", async () => {
  setup();
  let deliverRead, deliverWrite;
  const sent = [];
  global.fetch = async (_url, options) => {
    if (options?.method === "POST") {
      sent.push(JSON.parse(options.body));
      if (sent.length === 1)
        return new Promise((resolve) => {
          deliverWrite = resolve;
        });
      return reply({ ok: true });
    }
    return new Promise((resolve) => {
      deliverRead = resolve;
    });
  };
  const store = new LibraryStore("one", "one");
  const refresh = store.refresh();
  store.change((library) => ({ ...library, favorites: [article()] }));
  deliverRead(
    reply({
      ...emptyLibrary(),
      notebookEntries: [
        {
          ...card,
          id: "word-1",
          key: "resilient",
          createdAt: stamp,
          updatedAt: stamp,
        },
      ],
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(sent.length, 1);
  store.change((library) => ({
    ...library,
    libraryFolders: [
      {
        id: "folder-1",
        name: "IELTS",
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: "",
      },
    ],
  }));
  deliverWrite(reply({ ok: true }));
  await refresh;
  assert.equal(sent.length, 2);
  assert.equal(sent[1].favorites.length, 1);
  assert.equal(sent[1].notebookEntries.length, 1);
  assert.equal(sent[1].libraryFolders.length, 1);
  store.dispose();
});
test("stale authentication responses never publish into a different account", async () => {
  setup();
  let deliver;
  global.fetch = () =>
    new Promise((resolve) => {
      deliver = resolve;
    });
  const store = new LibraryStore("one", "one");
  const request = store.refresh();
  values.set("texta_auth_token", "two");
  deliver(reply({ ...emptyLibrary(), favorites: [article()] }));
  await request;
  assert.equal(store.getSnapshot().library.favorites.length, 0);
  store.dispose();
});
test("newer deletion markers and first introduction dates survive cloud merge and card hydration", () => {
  const original = article(),
    tombstone = {
      ...original,
      deletedAt: "2026-10-08T00:00:00.000Z",
      updatedAt: "2026-10-08T00:00:00.000Z",
    };
  const merged = mergeLibrary(
    { favorites: [tombstone] },
    { favorites: [original] },
  );
  assert.equal(merged.favorites[0].deletedAt, tombstone.deletedAt);
  assert.equal(merged.favorites[0].createdAt, stamp);
  const lib = addNotebook(emptyLibrary(), [card], original),
    dated = {
      ...lib,
      notebookEntries: lib.notebookEntries.map((row) => ({
        ...row,
        createdAt: stamp,
      })),
    };
  const full = addNotebook(dated, [{ ...card, antonyms: [] }]);
  assert.equal(full.notebookEntries[0].createdAt, stamp);
  assert.equal(full.notebookEntries[0].sourceArticle.id, original.id);
  assert.equal(full.notebookEntries[0].usIpa, card.usIpa);
});
test("legacy phrase identifiers and default bilingual mode stay compatible", () => {
  const entry = {
    ...card,
    word: "take care of",
    key: "take-care-of",
    id: "phrase",
    createdAt: stamp,
    updatedAt: stamp,
  };
  const merged = mergeLibrary(
    {
      notebookEntries: [entry],
      vocabPrefs: {
        "take-care-of": {
          word: "take care of",
          mastery: "mastered",
          createdAt: stamp,
          updatedAt: stamp,
        },
      },
    },
    {},
  );
  const updated = addNotebook(merged, [{ ...card, word: "take care of" }]);
  assert.equal(updated.notebookEntries.length, 1);
  assert.equal(updated.notebookEntries[0].key, "take-care-of");
  assert.equal(updated.vocabPrefs["take-care-of"].mastery, "mastered");
  assert.equal(
    normalizeArticle({ article: "Old English article" }).generationMode,
    "standard",
  );
});
test("exact bilingual occurrence selection preserves sentence context and contextual senses", () => {
  const value = article();
  assert.equal(highlights(value, value.paragraphsEn[0], 0, "en")[0].start, 2);
  assert.equal(highlights(value, value.paragraphsZh[0], 0, "zh")[0].end, 6);
  assert.equal(
    articleContext(value, "resilient", 0, 0).zh,
    value.sentencePairs[0].zh,
  );
  const full = hydrateLexicon(value, [
    { ...card, senses: [{ meaning: "词典义项" }], baseMeanings: ["词典义项"] },
  ]);
  assert.equal(full.lexicon[0].senses[0].meaning, "有韧性的");
  assert.equal(full.baseLexicon[0].senses[0].meaning, "词典义项");
});
test("word import deduplicates case without breaking phrases, and exports escape all user content", () => {
  assert.deepEqual(
    splitWords("resilient, Resilient；take care of\nsustainable"),
    ["resilient", "take care of", "sustainable"],
  );
  assert.equal(
    importWords('[{"word":"take care of"},"adapt"]', "list.json"),
    "take care of, adapt",
  );
  const value = {
    ...article(),
    title: "<img src=x onerror=alert(1)>",
    paragraphsEn: ["<script>alert(1)</script> resilient"],
  };
  const html = buildExportHtml(
    { article: value },
    { title: value.title, includeChinese: true, margin: 12 },
  );
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("有韧性"));
});

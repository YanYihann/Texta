export type GenerationMode = "mixed" | "standard";
export type Mastery = "unknown" | "mastered";
export interface User {
  id: string;
  name: string;
  email?: string;
  role: string;
  plan: string;
  permanentPlan?: string;
  planExpiresAt?: string | null;
  createdAt?: string;
}
export interface Usage {
  used: number;
  remaining: number | null;
  limit: number | null;
  dateKey?: string;
}
export interface Sense {
  meaning: string;
  marker?: string;
  pos?: string;
  examples?: string[];
}
export interface LexiconEntry {
  word: string;
  pos?: string;
  usIpa?: string;
  ukIpa?: string;
  ipa?: string;
  summary?: string;
  senses: Sense[];
  baseMeanings?: string[];
  detailsReady?: boolean;
  collocations?: string[];
  synonyms?: string[];
  antonyms?: string[];
  wordFormation?: string;
}
export interface Occurrence {
  paragraph: number;
  sentence: number;
  enStart: number;
  enEnd: number;
  zhStart: number;
  zhEnd: number;
}
export interface Alignment {
  word: string;
  english_forms?: string[];
  zh_terms?: string[];
  occurrences?: Occurrence[];
}
export interface SentencePair {
  paragraph: number;
  en: string;
  zh: string;
}
export interface ContextGloss {
  word: string;
  pos?: string;
  meaning?: string;
  contextMeaning?: string;
  marker?: string;
  sentence?: string;
  translation?: string;
}
export interface ArticleRun {
  type: string;
  text: string;
  word?: string;
  wordKey?: string;
  key?: string;
  pos?: string;
  meaning?: string;
  displayMeaning?: string;
  marker?: string;
  paragraphIndex?: number;
  charStart?: number;
  charEnd?: number;
}
export interface Article {
  id: string;
  title: string;
  words: string[];
  article: string;
  lexicon: LexiconEntry[];
  baseLexicon: LexiconEntry[];
  paragraphsEn: string[];
  paragraphsZh: string[];
  alignment: Alignment[];
  sentencePairs: SentencePair[];
  contextGlosses: ContextGloss[];
  runs: ArticleRun[];
  generationMode: GenerationMode;
  generationQuality: "normal";
  missing: string[];
  savedAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  folderId: string;
}
export interface NotebookEntry extends LexiconEntry {
  id: string;
  key: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  sourceArticle?: Article | null;
}
export interface WordPreference {
  word: string;
  mastery: Mastery;
  createdAt: string;
  updatedAt: string;
}
export interface Folder {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
}
export interface Library {
  favorites: Article[];
  notebookEntries: NotebookEntry[];
  vocabPrefs: Record<string, WordPreference>;
  libraryFolders: Folder[];
}
export interface WechatConnection {
  bound: boolean;
  loginAvailable: boolean;
}
export interface BillingProduct {
  id: string;
  plan: string;
  term: string;
  name: string;
  amountFen: number;
  dailyCredits: number;
}
export interface PaymentOrder {
  id: string;
  product: string;
  amountFen: number;
  status: string;
  expiresAt: string;
  checkoutUrl?: string;
}

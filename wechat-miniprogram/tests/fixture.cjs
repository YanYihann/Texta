const entries = [
  { word: 'journey', pos: 'n.', usIpa: '/ˈdʒɜːrni/', ukIpa: '/ˈdʒɜːni/', baseMeanings: ['旅行；旅程'], collocations: ['a long journey · 漫长的旅程'], synonyms: ['trip · 旅行'], antonyms: [], wordFormation: '整体词，常用作名词。', detailsReady: true },
  { word: 'curious', pos: 'adj.', usIpa: '/ˈkjʊriəs/', ukIpa: '/ˈkjʊəriəs/', baseMeanings: ['好奇的；求知欲强的'], collocations: ['curious about · 对……好奇'], synonyms: ['inquisitive · 好问的'], antonyms: [], wordFormation: '形容词，相关名词为 curiosity。', detailsReady: true }
];
module.exports = { id: 'smoke-article', title: 'A Small Journey · 测试文章', words: ['journey', 'curious'],
  article: 'A curious student began a journey. She wanted to discover something new.',
  paragraphsEn: ['A curious student began a journey.', 'She wanted to discover something new.'],
  paragraphsZh: ['一个好奇的学生开始了一段旅程。', '她想发现一些新事物。'],
  generationMode: 'standard', generationQuality: 'normal', baseLexicon: entries, lexicon: entries,
  contextGlosses: [{ word: 'journey', contextMeaning: '旅程' }, { word: 'curious', contextMeaning: '好奇的' }],
  alignment: [{ word: 'curious', occurrences: [{ paragraph: 0, enStart: 2, enEnd: 9, zhStart: 2, zhEnd: 5 }] },
    { word: 'journey', occurrences: [{ paragraph: 0, enStart: 26, enEnd: 33, zhStart: 12, zhEnd: 14 }] }],
  createdAt: '2026-10-06T12:00:00.000Z' };

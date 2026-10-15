const api = require('../../utils/api');
const library = require('../../utils/library');
const { key } = require('../../utils/words');
Component({
  options: { addGlobalClass: true },
  properties: { open: Boolean, entry: Object, article: Object },
  data: { inNotebook: false, mastered: false, feedback: '', saving: false },
  observers: {
    'open, entry': function(open, entry) {
      if (!open || !entry) return;
      const value = library.read(), id = key(entry.word);
      this.setData({ inNotebook: value.notebookEntries.some(row => row.key === id && !row.deletedAt),
        mastered: !!(value.vocabPrefs[id] && value.vocabPrefs[id].mastery === 'mastered'), feedback: '' });
    }
  },
  methods: {
    noop() {},
    close() { this.triggerEvent('close'); },
    async addWord() {
      if (!api.requireLogin() || this.data.saving) return;
      this.setData({ saving: true, feedback: '' });
      try {
        library.addWord(this.properties.entry, this.properties.article);
        this.setData({ inNotebook: true }); this.triggerEvent('change');
        await library.sync(); this.setData({ feedback: '已加入生词本并同步。' });
      } catch (error) { this.setData({ feedback: '本地修改已保留；' + error.message }); }
      finally { this.setData({ saving: false }); }
    },
    async toggleMastery() {
      if (!api.requireLogin() || this.data.saving) return;
      const mastered = !this.data.mastered;
      this.setData({ saving: true });
      try {
        library.setMastery(this.properties.entry.word, mastered);
        this.setData({ mastered }); this.triggerEvent('change');
        await library.sync();
      } catch (error) { this.setData({ feedback: '本地修改已保留；' + error.message }); }
      finally { this.setData({ saving: false }); }
    },
    source() { this.triggerEvent('source'); }
  }
});

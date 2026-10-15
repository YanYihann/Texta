const theme = require('../../utils/theme');
Component({
  options: { addGlobalClass: true },
  properties: { selected: String, expanded: Boolean },
  data: { palettes: theme.palettes.map(p => ({ id: p.id, name: p.name, swatch: p.swatch })) },
  methods: {
    open() { wx.showActionSheet({ itemList: theme.palettes.map(p => p.name + (p.id === this.properties.selected ? ' · 当前' : '')), success: res => theme.set(theme.palettes[res.tapIndex].id) }); },
    choose(e) { theme.set(e.currentTarget.dataset.id); }
  }
});

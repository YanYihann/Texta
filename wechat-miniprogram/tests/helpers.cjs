const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
function setup() {
  for (const id of Object.keys(require.cache)) if (id.includes('miniprogram' + require('path').sep)) delete require.cache[id];
  const storage = new Map(), requests = [], navigation = [], app = { globalData: {} };
  let handler = options => options.success({ statusCode: 200, data: {} });
  global.wx = {
    getStorageSync: id => clone(storage.get(id)),
    setStorageSync: (id, value) => storage.set(id, clone(value)),
    removeStorageSync: id => storage.delete(id),
    request(options) { requests.push(options); handler(options); },
    navigateTo: options => navigation.push(options.url),
    navigateBack: () => navigation.push('back'),
    switchTab: options => navigation.push(options.url),
    showToast() {},
    showModal: options => options.success({ confirm: true }),
    stopPullDownRefresh() {},
    setClipboardData() {}
  };
  global.getApp = () => app;
  global.getCurrentPages = () => [1, 2];
  const api = require('../miniprogram/utils/api');
  const library = require('../miniprogram/utils/library');
  function login(id = 'user-a') { api.saveSession({ token: 'token-' + id, user: { id, email: id + '@example.com' }, expiresAt: Date.now() + 3600000 }); }
  function page(relative) {
    const modulePath = require.resolve('../miniprogram/pages/' + relative); delete require.cache[modulePath];
    let definition; global.Page = value => { definition = value; }; require(modulePath);
    const instance = Object.assign({}, definition, { data: clone(definition.data), setData(value) { Object.assign(this.data, value); } }); return instance;
  }
  return { storage, requests, navigation, app, api, library, login, page, handle(fn) { handler = fn; } };
}
module.exports = { setup };

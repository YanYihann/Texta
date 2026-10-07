const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('public/app.js', 'utf8');
const start = source.indexOf('let wechatConnectionRequest = null;');
const end = source.indexOf('async function refreshUsage()', start);
function harness(fetcher) {
  const elements = Array.from({ length: 4 }, () => ({ textContent: '', dataset: {}, attributes: {}, hidden: false,
    classList: { toggle() {} }, setAttribute(name, value) { this.attributes[name] = value; } }));
  const context = vm.createContext({ authToken: 'session-a', currentUser: { id: 'a' },
    localStorage: { token: 'session-a', getItem() { return this.token; } }, apiFetch: fetcher,
    wechatConnectionStateEl: elements[0], wechatConnectionHintEl: elements[1],
    wechatConnectionHelpEl: elements[2], refreshWechatConnectionBtn: elements[3] });
  elements[2].classList.toggle = (name, hidden) => { elements[2].hidden = hidden; };
  vm.runInContext(source.slice(start, end), context);
  return { context, elements, refresh: () => context.refreshWechatConnection() };
}
function response(data, status = 200) { return { status, ok: status === 200, json: async () => data }; }

test('web connection status distinguishes saved binding, missing binding, disabled login and failed authentication', async () => {
  for (const [data, status, state, help] of [
    [{ ok: true, bound: true, loginAvailable: true }, 200, 'bound', false],
    [{ ok: true, bound: false, loginAvailable: true }, 200, 'unbound', true],
    [{ ok: true, bound: true, loginAvailable: false }, 200, 'bound', false],
    [{ ok: true, bound: false, loginAvailable: false }, 200, 'unavailable', false],
    [{}, 401, 'error', false], [{}, 503, 'error', false], [{ bound: false }, 200, 'error', false]
  ]) {
    const h = harness(async () => response(data, status)); await h.refresh();
    assert.equal(h.elements[0].dataset.state, state); assert.equal(!h.elements[2].hidden, help);
    assert.equal(h.elements[3].disabled, false); assert.equal(h.elements[3].attributes['aria-busy'], 'false');
  }
});

test('duplicate refreshes share a request and stale responses never label a changed account as linked', async () => {
  let resolve, calls = 0;
  const pending = new Promise(done => { resolve = done; });
  const h = harness(async () => { calls++; return pending; });
  const first = h.refresh(); await h.refresh(); assert.equal(calls, 1); assert.equal(h.elements[3].disabled, true);
  h.context.localStorage.token = 'session-b';
  resolve(response({ ok: true, bound: true, loginAvailable: true })); await first;
  assert.equal(h.elements[0].dataset.state, 'error'); assert.match(h.elements[1].textContent, /账号已改变/);
  assert.equal(h.elements[3].disabled, false);
});

test('network failure cannot change an unknown binding into an unbound account, and a retry recovers', async () => {
  let failed = true;
  const h = harness(async () => { if (failed) throw TypeError('Network'); return response({ ok: true, bound: true, loginAvailable: true }); });
  await h.refresh(); assert.equal(h.elements[0].dataset.state, 'error'); assert.equal(h.elements[2].hidden, true);
  failed = false; await h.refresh(); assert.equal(h.elements[0].dataset.state, 'bound');
});

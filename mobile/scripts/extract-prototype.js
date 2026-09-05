/**
 * Runs the Girki prototype's own JavaScript under a stub DOM and returns its
 * data structures.
 *
 * Everything downstream — the content bundle and the verification script — uses
 * this, so the source of truth is the prototype executing, not a regex reading
 * it. Regexes over 470KB of HTML miss parenthesised filenames and count photo
 * briefs as recipe notes; running the file cannot.
 *
 *   node scripts/extract-prototype.js            # writes girki_raw.json
 *   import { extractPrototype } from './extract-prototype.js'
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DEFAULT_PROTOTYPE = path.join(
  __dirname, '..', '..', 'docs', 'prototypes', 'Girki_V54_Signup_Spacing.html'
);

/** A permissive stand-in for anything the prototype touches in a browser. */
function domStub() {
  const target = function () { return proxy; };
  const proxy = new Proxy(target, {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === 'then') return undefined;
      if (prop === 'length') return 0;
      if (prop === 'value' || prop === 'textContent' || prop === 'innerHTML') return '';
      if (prop === 'files') return [];
      if (prop === Symbol.iterator) return function* () {};
      return proxy;
    },
    set: () => true,
    apply: () => proxy,
    construct: () => proxy,
    has: () => true,
  });
  return proxy;
}

function scriptSource(html) {
  const blocks = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  let match = re.exec(html);
  while (match) {
    blocks.push(match[1]);
    match = re.exec(html);
  }
  return blocks.join('\n');
}

/** Regexes and functions cannot be JSON; keep them as data. */
function serialise(value) {
  if (value instanceof RegExp) return { __regex: value.source, flags: value.flags };
  if (typeof value === 'function') {
    try {
      return { __fn: true, result: serialise(value('Ghana')) };
    } catch {
      return { __fn: true, result: null };
    }
  }
  if (Array.isArray(value)) return value.map(serialise);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serialise(v);
    return out;
  }
  return value;
}

function extractPrototype(prototypePath = DEFAULT_PROTOTYPE) {
  const html = fs.readFileSync(prototypePath, 'utf8');
  const js = scriptSource(html);

  // Top-level data bindings are lexical, so they are not visible on the
  // sandbox object. Ask the prototype to hand them over on its way out.
  const names = [...new Set(
    [...js.matchAll(/^(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/gm)]
      .map((m) => m[1])
      .filter((n) => /^[A-Z][A-Z0-9_]*$/.test(n) || n === 'meals' || n === 'worlds')
  )];

  const storage = new Map();
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    document: domStub(),
    navigator: { userAgent: 'node', language: 'en-GB' },
    location: { reload() {}, href: '' },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    setTimeout: () => 0, setInterval: () => 0, clearInterval() {}, clearTimeout() {},
    requestAnimationFrame: () => 0,
    fetch: () => Promise.resolve({ ok: false, json: async () => ({}) }),
    Image: function () {}, Audio: function () { return { play() {} }; },
    speechSynthesis: domStub(), SpeechSynthesisUtterance: function () {},
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    MutationObserver: function () { return { observe() {}, disconnect() {} }; },
    IntersectionObserver: function () { return { observe() {}, disconnect() {}, unobserve() {} }; },
    ResizeObserver: function () { return { observe() {}, disconnect() {} }; },
    CustomEvent: function () {}, Event: function () {},
    AbortController: function () { return { signal: {}, abort() {} }; },
    performance: { now: () => 0 },
    addEventListener() {}, alert() {},
    btoa: (v) => Buffer.from(String(v)).toString('base64'),
    atob: (v) => Buffer.from(String(v), 'base64').toString(),
    Math, Date, JSON, RegExp, Object, Array, String, Number, Boolean, Set, Map, Promise, Intl,
    isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, URL, URLSearchParams, Error,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const source = `${js}\n;globalThis.__EXPORT__ = { ${names.join(', ')} };\n`;
  let threw = null;
  try {
    vm.runInContext(source, sandbox, { filename: 'girki-prototype.js' });
  } catch (error) {
    threw = error.message;
  }

  const exported = sandbox.__EXPORT__ || {};
  const out = {};
  for (const name of names) {
    const value = exported[name] !== undefined ? exported[name] : sandbox[name];
    if (value !== undefined) out[name] = serialise(value);
  }

  return { data: out, names, threw, html };
}

/** Every remote image URL in the prototype, parenthesised filenames included. */
function imageUrls(html) {
  const urls = new Set();
  for (const raw of html.match(/https?:\/\/[^\s"'<>\\`]+/g) || []) {
    let url = raw.replace(/&amp;/g, '&').replace(/[.,;]+$/, '');
    while (url.endsWith(')') && url.split('(').length - 1 < url.split(')').length - 1) {
      url = url.slice(0, -1);
    }
    if (/unsplash|FilePath|upload\.wikimedia/.test(url)) urls.add(url);
  }
  return [...urls].sort();
}

module.exports = { extractPrototype, imageUrls, DEFAULT_PROTOTYPE };

if (require.main === module) {
  const { data, threw } = extractPrototype();
  if (threw) console.error('note: prototype threw under the stub DOM (expected):', threw);
  const target = process.argv[2] || path.join(__dirname, '..', 'girki_raw.json');
  fs.writeFileSync(target, JSON.stringify(data, null, 1));
  console.log('wrote', target);
}

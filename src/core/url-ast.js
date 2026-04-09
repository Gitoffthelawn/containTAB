/**
 * url-ast.js — RFC 3986 URL AST parser
 *
 * Two-phase: Lexer (char scan → token stream) → Parser (recursive descent → AST)
 * Single entry point: extract(url, field)
 *
 * Zero dependency. Pure functions. Works in browser.
 */

// ─── Token types ────────────────────────────────────────────────────

const T = {
  COLON: ':', SLASH: '/', AT: '@', DOT: '.', QUESTION: '?', HASH: '#',
  BRACKET_OPEN: '[', BRACKET_CLOSE: ']', PERCENT: '%',
  LABEL: 'LABEL', DIGITS: 'DIGITS', TEXT: 'TEXT',
  EOF: 'EOF', ERROR: 'ERROR',
};

// ─── Character classifiers ──────────────────────────────────────────

const C_0 = 48, C_9 = 57, C_A = 65, C_Z = 90, C_a = 97, C_z = 122;
const C_DASH = 45, C_DOT = 46, C_PLUS = 43, C_UNDER = 95, C_TILDE = 126;

function isAlpha(c) { return (c >= C_a && c <= C_z) || (c >= C_A && c <= C_Z); }
function isDigit(c) { return c >= C_0 && c <= C_9; }
function isAlphaNum(c) { return isAlpha(c) || isDigit(c); }
// eslint-disable-next-line no-unused-vars -- reserved for future percent-encoding validation
function isHexDigit(c) {
  return isDigit(c) || (c >= C_a && c <= 102) || (c >= C_A && c <= 70);
}
// eslint-disable-next-line no-unused-vars -- reserved for future scheme validation
function isSchemeChar(c) {
  return isAlphaNum(c) || c === C_PLUS || c === C_DASH || c === C_DOT;
}
// eslint-disable-next-line no-unused-vars -- reserved for future URI char validation
function isUnreserved(c) {
  return isAlphaNum(c) || c === C_DASH || c === C_DOT || c === C_UNDER || c === C_TILDE;
}
// eslint-disable-next-line no-unused-vars -- reserved for future sub-delimiter validation
function isSubDelim(c) {
  return '!$&\'()*+,;='.indexOf(String.fromCharCode(c)) >= 0;
}
const DELIMITERS = ':/?#[]@';
function isDelimiter(c) { return DELIMITERS.indexOf(String.fromCharCode(c)) >= 0; }

// ─── Lexer ──────────────────────────────────────────────────────────

/**
 * Tokenize a URL string into a token array.
 * Each token: { type, value, span: [start, end] }
 *
 * @param {string} input
 * @returns {Array<{type: string, value: string, span: number[]}>}
 */
export function tokenize(input) {
  const tokens = [];
  const len = input.length;
  let i = 0;

  function emit(type, value, start, end) {
    tokens.push({ type, value, span: [start, end] });
  }

  while (i < len) {
    const c = input.charCodeAt(i);
    const ch = input[i];

    // single-char delimiters
    if (ch === ':') { emit(T.COLON, ':', i, i + 1); i++; continue; }
    if (ch === '/') { emit(T.SLASH, '/', i, i + 1); i++; continue; }
    if (ch === '@') { emit(T.AT, '@', i, i + 1); i++; continue; }
    if (ch === '.') { emit(T.DOT, '.', i, i + 1); i++; continue; }
    if (ch === '?') { emit(T.QUESTION, '?', i, i + 1); i++; continue; }
    if (ch === '#') { emit(T.HASH, '#', i, i + 1); i++; continue; }
    if (ch === '[') { emit(T.BRACKET_OPEN, '[', i, i + 1); i++; continue; }
    if (ch === ']') { emit(T.BRACKET_CLOSE, ']', i, i + 1); i++; continue; }

    // percent-encoded
    if (ch === '%') {
      emit(T.PERCENT, '%', i, i + 1);
      i++;
      continue;
    }

    // digits run
    if (isDigit(c)) {
      const start = i;
      while (i < len && isDigit(input.charCodeAt(i))) i++;
      emit(T.DIGITS, input.slice(start, i), start, i);
      continue;
    }

    // label: alpha / alphanumeric+dash (DNS label chars)
    if (isAlpha(c) || c === C_DASH || c === C_UNDER || c === C_TILDE) {
      const start = i;
      while (i < len) {
        const cc = input.charCodeAt(i);
        if (isAlphaNum(cc) || cc === C_DASH || cc === C_UNDER || cc === C_TILDE || cc === C_PLUS) {
          i++;
        } else {
          break;
        }
      }
      emit(T.LABEL, input.slice(start, i), start, i);
      continue;
    }

    // anything else: TEXT
    const start = i;
    while (i < len && !isDelimiter(input.charCodeAt(i)) && input[i] !== '%'
      && !isAlphaNum(input.charCodeAt(i))) {
      i++;
    }
    if (i === start) i++; // consume at least one char
    emit(T.TEXT, input.slice(start, i), start, i);
  }

  emit(T.EOF, '', len, len);
  return tokens;
}

// ─── Parser ─────────────────────────────────────────────────────────

/**
 * Recursive descent parser. Consumes token stream, produces AST.
 */
class Parser {
  constructor(tokens, raw) {
    this.tokens = tokens;
    this.pos = 0;
    this.raw = raw;
  }

  peek() { return this.tokens[this.pos] || { type: T.EOF, value: '', span: [0, 0] }; }
  advance() { return this.tokens[this.pos++]; }
  at(type) { return this.peek().type === type; }
  atValue(type, value) { return this.peek().type === type && this.peek().value === value; }

  expect(type) {
    if (this.at(type)) return this.advance();
    return null;
  }

  // collect everything until one of the stop types
  collectUntil(...stopTypes) {
    let value = '';
    const start = this.peek().span[0];
    while (!this.at(T.EOF) && !stopTypes.includes(this.peek().type)) {
      value += this.advance().value;
    }
    return { value, span: [start, this.peek().span[0]] };
  }

  // URI = scheme ":" hier-part [ "?" query ] [ "#" fragment ]
  parseUri() {
    const children = [];
    // scheme
    const scheme = this.parseScheme();
    if (scheme) children.push(scheme);

    // hier-part
    const hierPart = this.parseHierPart();
    children.push(...hierPart);

    // query
    if (this.at(T.QUESTION)) {
      children.push(this.parseQuery());
    }

    // fragment
    if (this.at(T.HASH)) {
      children.push(this.parseFragment());
    }

    return {
      type: 'uri',
      children,
      raw: this.raw,
      error: null,
    };
  }

  // scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )
  parseScheme() {
    // look ahead for scheme: need LABEL followed by COLON (before any SLASH)
    const saved = this.pos;

    // scheme can be LABEL or LABEL+DIGITS mix — scan tokens until COLON
    let schemeValue = '';
    const start = this.peek().span[0];

    // first token must start with alpha
    if (!this.at(T.LABEL)) {
      this.pos = saved;
      return null;
    }

    // scan for colon, but abort if we hit slash/question/hash first
    let lookahead = this.pos;
    let found = false;
    while (lookahead < this.tokens.length) {
      const t = this.tokens[lookahead];
      if (t.type === T.COLON) { found = true; break; }
      if (t.type === T.SLASH || t.type === T.QUESTION || t.type === T.HASH || t.type === T.EOF) break;
      lookahead++;
    }

    if (!found) {
      this.pos = saved;
      return null;
    }

    // consume tokens until colon
    while (!this.at(T.COLON) && !this.at(T.EOF)) {
      schemeValue += this.advance().value;
    }
    const colonSpanEnd = this.peek().span[1];
    this.expect(T.COLON); // consume ':'

    return { type: 'scheme', value: schemeValue, span: [start, colonSpanEnd] };
  }

  // hier-part = "//" authority path-abempty / path-absolute / path-rootless / path-empty
  parseHierPart() {
    const nodes = [];

    // check for "//"
    if (this.at(T.SLASH) && this.pos + 1 < this.tokens.length
      && this.tokens[this.pos + 1].type === T.SLASH) {
      this.advance(); // first /
      this.advance(); // second /

      const authority = this.parseAuthority();
      if (authority) nodes.push(authority);
    }

    // path (everything until ? or # or EOF)
    const path = this.parsePath();
    if (path) nodes.push(path);

    return nodes;
  }

  // authority = [ userinfo "@" ] host [ ":" port ]
  parseAuthority() {
    const children = [];
    const start = this.peek().span[0];

    // scan ahead for @ to detect userinfo
    let hasAt = false;
    let atPos = -1;
    for (let i = this.pos; i < this.tokens.length; i++) {
      const t = this.tokens[i];
      if (t.type === T.AT) { hasAt = true; atPos = i; break; }
      if (t.type === T.SLASH || t.type === T.QUESTION || t.type === T.HASH || t.type === T.EOF) break;
    }

    // userinfo
    if (hasAt) {
      let userinfo = '';
      const uiStart = this.peek().span[0];
      while (this.pos < atPos) {
        userinfo += this.advance().value;
      }
      this.advance(); // consume @
      children.push({ type: 'userinfo', value: userinfo, span: [uiStart, this.peek().span[0]] });
    }

    // host — collect until : (port) or / or ? or # or EOF
    const host = this.parseHostFromTokens();
    if (host) children.push(host);

    // port
    if (this.at(T.COLON)) {
      const colonTok = this.advance();
      if (this.at(T.DIGITS)) {
        const digitsTok = this.advance();
        children.push({
          type: 'port',
          value: parseInt(digitsTok.value, 10),
          span: [colonTok.span[0], digitsTok.span[1]],
        });
      }
    }

    const end = this.peek().span[0];
    return { type: 'authority', children, span: [start, end] };
  }

  // host: collect tokens until COLON (port) / SLASH / QUESTION / HASH / EOF
  // then sub-parse the host string
  parseHostFromTokens() {
    const start = this.peek().span[0];
    let hostStr = '';
    let hasBracket = false;

    while (!this.at(T.EOF)) {
      const t = this.peek();
      // stop conditions (but allow colon inside brackets for IPv6)
      if (t.type === T.SLASH || t.type === T.QUESTION || t.type === T.HASH) break;
      if (t.type === T.COLON && !hasBracket) break;

      if (t.type === T.BRACKET_OPEN) hasBracket = true;
      if (t.type === T.BRACKET_CLOSE) hasBracket = false;

      hostStr += this.advance().value;
    }

    if (!hostStr) return null;

    const end = this.peek().span[0];
    return parseHostString(hostStr, [start, end]);
  }

  // path: collect until QUESTION / HASH / EOF
  parsePath() {
    if (this.at(T.QUESTION) || this.at(T.HASH) || this.at(T.EOF)) return null;
    const { value, span } = this.collectUntil(T.QUESTION, T.HASH, T.EOF);
    if (!value) return null;
    return { type: 'path', value, span };
  }

  // query: consume ? then collect until # / EOF
  parseQuery() {
    const qTok = this.advance(); // consume ?
    const start = qTok.span[0];
    const { value, span } = this.collectUntil(T.HASH, T.EOF);
    return { type: 'query', value, span: [start, span[1]] };
  }

  // fragment: consume # then collect until EOF
  parseFragment() {
    const hTok = this.advance(); // consume #
    const start = hTok.span[0];
    const { value } = this.collectUntil(T.EOF);
    const end = this.peek().span[1];
    return { type: 'fragment', value, span: [start, end] };
  }
}

// ─── Host sub-parser ────────────────────────────────────────────────

const COMPOUND_SECOND = new Set([
  'co', 'com', 'org', 'net', 'edu', 'gov', 'ac', 'mil',
  'or', 'ne', 'go', 'gob', 'nic', 'gen', 'biz', 'info',
  'nom', 'int', 'rec', 'web', 'ltd', 'ind', 'res',
]);

/**
 * Parse a host string into a typed host AST node.
 *
 * @param {string} hostStr - raw host string (may include brackets for IPv6)
 * @param {number[]} span
 * @returns {object} host AST node
 */
function parseHostString(hostStr, span) {
  const base = { type: 'host', span, raw: hostStr };

  // empty
  if (!hostStr) {
    return { ...base, variant: 'empty', error: null };
  }

  // IPv6: [...]
  if (hostStr[0] === '[') {
    const close = hostStr.indexOf(']');
    const address = close > 0 ? hostStr.slice(1, close) : hostStr.slice(1);
    return { ...base, variant: 'ipv6', address, error: null };
  }

  // IPv6 without brackets (raw from URL constructor): contains colon
  if (hostStr.includes(':')) {
    return { ...base, variant: 'ipv6', address: hostStr, error: null };
  }

  // strip trailing dot
  const normalized = hostStr.endsWith('.') ? hostStr.slice(0, -1) : hostStr;
  const labels = normalized.split('.');

  // single label
  if (labels.length === 1) {
    return {
      ...base, variant: 'single', label: labels[0],
      punycode: labels[0].startsWith('xn--'),
      error: null,
    };
  }

  // IPv4: exactly 4 all-digit labels, each 0-255, no leading zeros
  if (labels.length === 4 && labels.every(l => /^\d+$/.test(l))) {
    const octets = labels.map(l => parseInt(l, 10));
    const valid = octets.every(n => n >= 0 && n <= 255)
      && labels.every(l => l === '0' || !l.startsWith('0'));
    if (valid) {
      return {
        ...base, variant: 'ipv4', octets,
        children: octets.map((n, i) => ({ type: 'octet', value: n, index: i })),
        error: null,
      };
    }
  }

  // reg-name: validate labels
  for (const label of labels) {
    if (label.length === 0 || label.length > 63) {
      return { ...base, variant: 'reg-name', error: 'invalid_label', reason: `empty or too long: "${label}"` };
    }
    if (label[0] === '-' || label[label.length - 1] === '-') {
      return { ...base, variant: 'reg-name', error: 'invalid_label', reason: `hyphen boundary: "${label}"` };
    }
  }

  // compound TLD heuristic
  const tldSpan = estimateTldSpan(labels);
  const tldLabels = labels.slice(-tldSpan);
  const domainIndex = labels.length - tldSpan - 1;
  const domain = domainIndex >= 0 ? labels[domainIndex] : null;
  const subLabels = domainIndex > 0 ? labels.slice(0, domainIndex) : [];

  const children = [];
  if (subLabels.length > 0) {
    children.push({ type: 'subdomain', value: subLabels.join('.'), labels: subLabels });
  }
  children.push({
    type: 'registrable',
    domain,
    tld: tldLabels.join('.'),
  });

  return {
    ...base,
    variant: 'reg-name',
    labels,
    domain,
    tld: tldLabels.join('.'),
    subdomain: subLabels.length > 0 ? subLabels.join('.') : null,
    punycode: labels.some(l => l.startsWith('xn--')),
    children,
    error: null,
  };
}

function estimateTldSpan(labels) {
  if (labels.length < 2) return 1;
  const last = labels[labels.length - 1];
  const secondLast = labels[labels.length - 2];
  if (last.length === 2 && COMPOUND_SECOND.has(secondLast.toLowerCase())) {
    return 2;
  }
  return 1;
}

// ─── AST → field extraction ─────────────────────────────────────────

function findChild(node, type) {
  if (!node || !node.children) return null;
  return node.children.find(c => c.type === type) || null;
}

function extractField(ast, field) {
  const authority = findChild(ast, 'authority');
  const host = authority ? findChild(authority, 'host') : null;

  switch (field) {
    case 'scheme': {
      const s = findChild(ast, 'scheme');
      return s ? s.value : null;
    }
    case 'hostname': {
      if (!host) return null;
      // empty host (about:blank, file:///) — return '' not null
      if (host.variant === 'empty') return '';
      return host.raw;
    }
    case 'domain': {
      return host && host.domain ? host.domain : null;
    }
    case 'tld': {
      return host && host.tld ? host.tld : null;
    }
    case 'subdomain': {
      return host && host.subdomain !== undefined ? host.subdomain : null;
    }
    case 'port': {
      const p = authority ? findChild(authority, 'port') : null;
      return p ? p.value : null;
    }
    case 'path': {
      const p = findChild(ast, 'path');
      return p ? p.value : null;
    }
    case 'query': {
      const q = findChild(ast, 'query');
      return q ? q.value : null;
    }
    case 'fragment': {
      const f = findChild(ast, 'fragment');
      return f ? f.value : null;
    }
    case 'host': {
      return host;
    }
    case 'ast': {
      return ast;
    }
    case 'tokens': {
      return null; // handled in extract() directly
    }
    default:
      return undefined;
  }
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Parse a URL string into an AST.
 *
 * @param {string} url
 * @returns {object} AST root node
 */
export function parse(url) {
  if (typeof url !== 'string') {
    return { type: 'uri', children: [], raw: String(url), error: 'not_a_string' };
  }
  const tokens = tokenize(url);
  const parser = new Parser(tokens, url);
  return parser.parseUri();
}

/**
 * Normalize IDN hostname to punycode via URL constructor.
 * Call this before matching/comparing, not inside the parser.
 *
 * @param {string} url
 * @returns {string} normalized URL (punycode hostname)
 */
export function normalizeIDN(url) {
  if (typeof url !== 'string') return url;
  // eslint-disable-next-line no-control-regex -- intentional ASCII range check for IDN detection
  if (!/[^\x00-\x7F]/.test(url)) return url;
  try { return new URL(url).href; } catch { return url; }
}

/**
 * Single entry point. Extract field(s) from a URL.
 *
 * @param {string} url - URL string
 * @param {string|string[]} field - field name or array of field names
 * @returns {*} extracted value, or object if array
 */
export function extract(url, field) {
  // tokens is special — no need to parse, no normalize
  if (field === 'tokens') {
    return tokenize(url);
  }

  // IDN normalize at usage layer, not parser layer
  const normalized = normalizeIDN(url);
  const ast = parse(normalized);
  ast.raw = url; // preserve original input

  // array of fields → object
  if (Array.isArray(field)) {
    const result = {};
    for (const f of field) {
      result[f] = f === 'tokens' ? tokenize(url) : extractField(ast, f);
    }
    return result;
  }

  return extractField(ast, field);
}

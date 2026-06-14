import { extract, parse, tokenize } from '../url-ast.js';

// ─── Lexer ──────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('basic HTTPS URL', () => {
    const tokens = tokenize('https://example.com/path');
    const types = tokens.map(t => t.type);
    expect(types).toContain('LABEL');
    expect(types).toContain(':');
    expect(types).toContain('/');
    expect(types).toContain('.');
    expect(types[types.length - 1]).toBe('EOF');
  });

  it('every token has span', () => {
    const tokens = tokenize('https://example.com');
    for (const t of tokens) {
      expect(t.span).toHaveLength(2);
      expect(t.span[0]).toBeLessThanOrEqual(t.span[1]);
    }
  });

  it('spans cover full input', () => {
    const input = 'https://a.com';
    const tokens = tokenize(input);
    // reconstruct from values (excluding EOF)
    const reconstructed = tokens.filter(t => t.type !== 'EOF').map(t => t.value).join('');
    expect(reconstructed).toBe(input);
  });

  it('IPv6 with brackets', () => {
    const tokens = tokenize('https://[::1]/');
    const types = tokens.map(t => t.type);
    expect(types).toContain('[');
    expect(types).toContain(']');
  });

  it('percent-encoded', () => {
    const tokens = tokenize('https://example.com/p%20ath');
    expect(tokens.some(t => t.type === '%')).toBe(true);
  });

  it('query and fragment', () => {
    const tokens = tokenize('https://example.com?q=1#sec');
    const types = tokens.map(t => t.type);
    expect(types).toContain('?');
    expect(types).toContain('#');
  });
});

// ─── Parser — scheme ────────────────────────────────────────────────

describe('parse — scheme', () => {
  it('https', () => {
    const ast = parse('https://example.com');
    const scheme = ast.children.find(c => c.type === 'scheme');
    expect(scheme.value).toBe('https');
  });

  it('http', () => {
    expect(extract('http://example.com', 'scheme')).toBe('http');
  });

  it('ftp', () => {
    expect(extract('ftp://files.example.com', 'scheme')).toBe('ftp');
  });

  it('about', () => {
    expect(extract('about:blank', 'scheme')).toBe('about');
  });

  it('data', () => {
    expect(extract('data:text/html,<h1>hi</h1>', 'scheme')).toBe('data');
  });

  it('no scheme returns null', () => {
    expect(extract('//example.com/path', 'scheme')).toBeNull();
  });
});

// ─── Parser — authority ─────────────────────────────────────────────

describe('parse — authority', () => {
  it('full authority with userinfo', () => {
    const ast = parse('https://user:pass@example.com:8080/path');
    const auth = ast.children.find(c => c.type === 'authority');
    expect(auth).toBeTruthy();

    const userinfo = auth.children.find(c => c.type === 'userinfo');
    expect(userinfo.value).toBe('user:pass');

    const port = auth.children.find(c => c.type === 'port');
    expect(port.value).toBe(8080);
  });

  it('authority without userinfo', () => {
    const ast = parse('https://example.com:443/');
    const auth = ast.children.find(c => c.type === 'authority');
    expect(auth.children.find(c => c.type === 'userinfo')).toBeFalsy();
    expect(auth.children.find(c => c.type === 'port').value).toBe(443);
  });

  it('authority without port', () => {
    const ast = parse('https://example.com/path');
    const auth = ast.children.find(c => c.type === 'authority');
    expect(auth.children.find(c => c.type === 'port')).toBeFalsy();
  });
});

// ─── Parser — path / query / fragment ───────────────────────────────

describe('parse — path, query, fragment', () => {
  it('path extracted', () => {
    expect(extract('https://example.com/a/b/c', 'path')).toBe('/a/b/c');
  });

  it('query extracted without ?', () => {
    expect(extract('https://example.com/path?q=1&sort=name', 'query')).toBe('q=1&sort=name');
  });

  it('fragment extracted without #', () => {
    expect(extract('https://example.com/page#section', 'fragment')).toBe('section');
  });

  it('all three present', () => {
    const r = extract('https://example.com/p?q=1#f', ['path', 'query', 'fragment']);
    expect(r.path).toBe('/p');
    expect(r.query).toBe('q=1');
    expect(r.fragment).toBe('f');
  });

  it('no path returns null', () => {
    expect(extract('https://example.com', 'path')).toBeNull();
  });

  it('no query returns null', () => {
    expect(extract('https://example.com/path', 'query')).toBeNull();
  });

  it('no fragment returns null', () => {
    expect(extract('https://example.com/path?q=1', 'fragment')).toBeNull();
  });
});

// ─── Host — IPv4 ────────────────────────────────────────────────────

describe('extract host — IPv4', () => {
  it('standard IPv4', () => {
    const host = extract('https://192.168.1.1/', 'host');
    expect(host.variant).toBe('ipv4');
    expect(host.octets).toEqual([192, 168, 1, 1]);
  });

  it('IPv4 with port', () => {
    const host = extract('https://192.168.1.1:3000/path', 'host');
    expect(host.variant).toBe('ipv4');
    expect(host.octets).toEqual([192, 168, 1, 1]);
  });

  it('loopback', () => {
    const host = extract('http://127.0.0.1/', 'host');
    expect(host.variant).toBe('ipv4');
    expect(host.octets).toEqual([127, 0, 0, 1]);
  });

  it('hostname returns IP string for IPv4', () => {
    expect(extract('https://192.168.1.1/', 'hostname')).toBe('192.168.1.1');
  });

  it('domain returns null for IPv4', () => {
    expect(extract('https://192.168.1.1/', 'domain')).toBeNull();
  });
});

// ─── Host — IPv6 ────────────────────────────────────────────────────

describe('extract host — IPv6', () => {
  it('loopback [::1]', () => {
    const host = extract('https://[::1]/', 'host');
    expect(host.variant).toBe('ipv6');
    expect(host.address).toBe('::1');
  });

  it('full IPv6', () => {
    const host = extract('https://[2001:db8::1]/', 'host');
    expect(host.variant).toBe('ipv6');
    expect(host.address).toBe('2001:db8::1');
  });

  it('IPv6 with port', () => {
    const host = extract('https://[::1]:8080/', 'host');
    expect(host.variant).toBe('ipv6');
  });
});

// ─── Host — single label ────────────────────────────────────────────

describe('extract host — single label', () => {
  it('localhost', () => {
    const host = extract('http://localhost/', 'host');
    expect(host.variant).toBe('single');
    expect(host.label).toBe('localhost');
  });

  it('localhost with port', () => {
    const host = extract('http://localhost:3000/', 'host');
    expect(host.variant).toBe('single');
    expect(host.label).toBe('localhost');
  });
});

// ─── Host — reg-name (simple TLD) ──────────────────────────────────

describe('extract host — simple TLD', () => {
  it('example.com', () => {
    const r = extract('https://example.com/path', ['hostname', 'domain', 'tld', 'subdomain']);
    expect(r.hostname).toBe('example.com');
    expect(r.domain).toBe('example');
    expect(r.tld).toBe('com');
    expect(r.subdomain).toBeNull();
  });

  it('www.example.com', () => {
    const r = extract('https://www.example.com/', ['domain', 'tld', 'subdomain']);
    expect(r.domain).toBe('example');
    expect(r.tld).toBe('com');
    expect(r.subdomain).toBe('www');
  });

  it('deep subdomain', () => {
    const r = extract('https://a.b.c.example.com/', ['domain', 'subdomain']);
    expect(r.domain).toBe('example');
    expect(r.subdomain).toBe('a.b.c');
  });
});

// ─── Host — compound TLD ────────────────────────────────────────────

describe('extract host — compound TLD', () => {
  it('amazon.co.uk', () => {
    const r = extract('https://amazon.co.uk/', ['domain', 'tld', 'subdomain']);
    expect(r.domain).toBe('amazon');
    expect(r.tld).toBe('co.uk');
    expect(r.subdomain).toBeNull();
  });

  it('www.amazon.co.uk', () => {
    const r = extract('https://www.amazon.co.uk/', ['domain', 'tld', 'subdomain']);
    expect(r.domain).toBe('amazon');
    expect(r.tld).toBe('co.uk');
    expect(r.subdomain).toBe('www');
  });

  it('example.com.au', () => {
    expect(extract('https://example.com.au/', 'tld')).toBe('com.au');
    expect(extract('https://example.com.au/', 'domain')).toBe('example');
  });

  it('example.co.jp', () => {
    expect(extract('https://example.co.jp/', 'tld')).toBe('co.jp');
    expect(extract('https://example.co.jp/', 'domain')).toBe('example');
  });

  it('example.org.uk', () => {
    expect(extract('https://example.org.uk/', 'tld')).toBe('org.uk');
  });

  it('example.edu.au', () => {
    expect(extract('https://example.edu.au/', 'tld')).toBe('edu.au');
  });

  it('mail.google.co.jp with subdomain', () => {
    const r = extract('https://mail.google.co.jp/', ['domain', 'tld', 'subdomain']);
    expect(r.domain).toBe('google');
    expect(r.tld).toBe('co.jp');
    expect(r.subdomain).toBe('mail');
  });
});

// ─── Host — non-compound ccTLD ──────────────────────────────────────

describe('extract host — non-compound ccTLD', () => {
  it('example.de (not compound)', () => {
    expect(extract('https://example.de/', 'tld')).toBe('de');
    expect(extract('https://example.de/', 'domain')).toBe('example');
  });

  it('example.cn', () => {
    expect(extract('https://example.cn/', 'tld')).toBe('cn');
  });
});

// ─── Host — punycode ────────────────────────────────────────────────

describe('extract host — punycode', () => {
  it('detects xn-- prefix in domain', () => {
    const host = extract('https://xn--r8jz45g.jp/', 'host');
    expect(host.punycode).toBe(true);
    expect(host.domain).toBe('xn--r8jz45g');
    expect(host.tld).toBe('jp');
  });

  it('punycode in subdomain', () => {
    const host = extract('https://xn--sub.example.com/', 'host');
    expect(host.punycode).toBe(true);
  });

  it('non-punycode', () => {
    const host = extract('https://example.com/', 'host');
    expect(host.punycode).toBe(false);
  });
});

// ─── extract — single field ─────────────────────────────────────────

describe('extract — single field', () => {
  const url = 'https://user:pass@www.amazon.co.uk:8080/path?q=1#sec';

  it('scheme', () => { expect(extract(url, 'scheme')).toBe('https'); });
  it('hostname', () => { expect(extract(url, 'hostname')).toBe('www.amazon.co.uk'); });
  it('domain', () => { expect(extract(url, 'domain')).toBe('amazon'); });
  it('tld', () => { expect(extract(url, 'tld')).toBe('co.uk'); });
  it('subdomain', () => { expect(extract(url, 'subdomain')).toBe('www'); });
  it('port', () => { expect(extract(url, 'port')).toBe(8080); });
  it('path', () => { expect(extract(url, 'path')).toBe('/path'); });
  it('query', () => { expect(extract(url, 'query')).toBe('q=1'); });
  it('fragment', () => { expect(extract(url, 'fragment')).toBe('sec'); });
});

// ─── extract — multi field ──────────────────────────────────────────

describe('extract — multi field', () => {
  it('returns object with requested fields', () => {
    const r = extract('https://www.example.com/path', ['hostname', 'domain', 'tld']);
    expect(r).toEqual({
      hostname: 'www.example.com',
      domain: 'example',
      tld: 'com',
    });
  });
});

// ─── extract — ast / tokens ─────────────────────────────────────────

describe('extract — ast and tokens', () => {
  it('ast returns full tree', () => {
    const ast = extract('https://example.com/', 'ast');
    expect(ast.type).toBe('uri');
    expect(ast.children.length).toBeGreaterThan(0);
    expect(ast.raw).toBe('https://example.com/');
  });

  it('tokens returns token array', () => {
    const tokens = extract('https://example.com/', 'tokens');
    expect(Array.isArray(tokens)).toBe(true);
    expect(tokens[tokens.length - 1].type).toBe('EOF');
  });
});

// ─── extract — edge cases ───────────────────────────────────────────

describe('extract — edge cases', () => {
  it('about:blank', () => {
    expect(extract('about:blank', 'scheme')).toBe('about');
    expect(extract('about:blank', 'hostname')).toBeNull();
  });

  it('data: URL', () => {
    expect(extract('data:text/html,<h1>hi</h1>', 'scheme')).toBe('data');
  });

  it('file:///etc/passwd', () => {
    expect(extract('file:///etc/passwd', 'scheme')).toBe('file');
    expect(extract('file:///etc/passwd', 'path')).toBe('/etc/passwd');
  });

  it('invalid URL returns error ast', () => {
    const ast = extract(123, 'ast');
    expect(ast.error).toBe('not_a_string');
  });

  it('empty string', () => {
    const ast = extract('', 'ast');
    expect(ast.type).toBe('uri');
  });

  it('unknown field returns undefined', () => {
    expect(extract('https://example.com', 'nonexistent')).toBeUndefined();
  });
});

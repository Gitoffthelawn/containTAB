import { match, ruleMatchesHost, sortBySpecificity } from '../matcher.js';

// Schema: Rule.schema.json x-tests + x-matching-rules

// ─── ruleMatchesHost ────────────────────────────────────────────────

describe('ruleMatchesHost — exact', () => {
  it('matches exact hostname', () => {
    expect(ruleMatchesHost('amazon.co.uk', { host: 'amazon.co.uk' })).toBe(true);
  });

  it('does not match subdomain', () => {
    expect(ruleMatchesHost('www.amazon.co.uk', { host: 'amazon.co.uk' })).toBe(false);
  });

  it('case-insensitive', () => {
    expect(ruleMatchesHost('GitHub.COM', { host: 'github.com' })).toBe(true);
    expect(ruleMatchesHost('github.com', { host: 'GitHub.COM' })).toBe(true);
  });

  it('does not match partial hostname', () => {
    expect(ruleMatchesHost('notgithub.com', { host: 'github.com' })).toBe(false);
    expect(ruleMatchesHost('github.com.evil.com', { host: 'github.com' })).toBe(false);
  });

  it('empty hostname never matches', () => {
    expect(ruleMatchesHost('', { host: 'github.com' })).toBe(false);
  });

  it('empty rule host never matches', () => {
    expect(ruleMatchesHost('github.com', { host: '' })).toBe(false);
    expect(ruleMatchesHost('', { host: '' })).toBe(false);
  });

  it('single-label hostname (localhost)', () => {
    expect(ruleMatchesHost('localhost', { host: 'localhost' })).toBe(true);
    expect(ruleMatchesHost('localhost', { host: 'LOCALHOST' })).toBe(true);
  });

  it('trailing dot in hostname does not match bare rule', () => {
    // URL constructor strips trailing dot, but if raw hostname has it
    expect(ruleMatchesHost('example.com.', { host: 'example.com' })).toBe(false);
  });
});

describe('ruleMatchesHost — wildcard', () => {
  it('matches single-level subdomain', () => {
    expect(ruleMatchesHost('www.amazon.co.uk', { host: '*.amazon.co.uk' })).toBe(true);
    expect(ruleMatchesHost('smile.amazon.co.uk', { host: '*.amazon.co.uk' })).toBe(true);
  });

  it('matches nested subdomain (multi-level)', () => {
    expect(ruleMatchesHost('a.b.example.com', { host: '*.example.com' })).toBe(true);
    expect(ruleMatchesHost('deep.a.b.example.com', { host: '*.example.com' })).toBe(true);
  });

  it('does not match parent domain itself', () => {
    expect(ruleMatchesHost('amazon.co.uk', { host: '*.amazon.co.uk' })).toBe(false);
    expect(ruleMatchesHost('example.com', { host: '*.example.com' })).toBe(false);
  });

  it('does not match unrelated domain', () => {
    expect(ruleMatchesHost('evil.com', { host: '*.amazon.co.uk' })).toBe(false);
  });

  it('does not match domain that ends with same suffix but different base', () => {
    // "fakeexample.com" ends with "example.com" string but is not a subdomain
    expect(ruleMatchesHost('fakeexample.com', { host: '*.example.com' })).toBe(false);
  });

  it('case-insensitive', () => {
    expect(ruleMatchesHost('WWW.EXAMPLE.COM', { host: '*.example.com' })).toBe(true);
    expect(ruleMatchesHost('www.example.com', { host: '*.EXAMPLE.COM' })).toBe(true);
  });

  it('broad wildcard *.com matches any .com subdomain', () => {
    expect(ruleMatchesHost('example.com', { host: '*.com' })).toBe(true);
    expect(ruleMatchesHost('a.b.c.com', { host: '*.com' })).toBe(true);
  });

  it('bare TLD does not match *.com', () => {
    // "com" alone does not end with ".com"
    expect(ruleMatchesHost('com', { host: '*.com' })).toBe(false);
  });

  it('amazon.* matches any TLD', () => {
    expect(ruleMatchesHost('amazon.com', { host: 'amazon.*' })).toBe(true);
    expect(ruleMatchesHost('amazon.co.uk', { host: 'amazon.*' })).toBe(true);
    expect(ruleMatchesHost('amazon.jp', { host: 'amazon.*' })).toBe(true);
    expect(ruleMatchesHost('example.com', { host: 'amazon.*' })).toBe(false);
  });

  it('*.google.* matches any subdomain + any TLD', () => {
    expect(ruleMatchesHost('www.google.com', { host: '*.google.*' })).toBe(true);
    expect(ruleMatchesHost('mail.google.co.jp', { host: '*.google.*' })).toBe(true);
    expect(ruleMatchesHost('google.com', { host: '*.google.*' })).toBe(false); // no subdomain
  });

  it('*google* matches anything containing google', () => {
    expect(ruleMatchesHost('www.google.com', { host: '*google*' })).toBe(true);
    expect(ruleMatchesHost('google.com', { host: '*google*' })).toBe(true);
    expect(ruleMatchesHost('mygooglestuff.net', { host: '*google*' })).toBe(true);
    expect(ruleMatchesHost('yahoo.com', { host: '*google*' })).toBe(false);
  });

  it('exact match when no wildcard', () => {
    expect(ruleMatchesHost('example.com', { host: 'example.com' })).toBe(true);
    expect(ruleMatchesHost('www.example.com', { host: 'example.com' })).toBe(false);
  });

  it('* alone matches any hostname', () => {
    expect(ruleMatchesHost('anything.com', { host: '*' })).toBe(true);
    expect(ruleMatchesHost('a', { host: '*' })).toBe(true);
    expect(ruleMatchesHost('', { host: '*' })).toBe(true);
  });

  it('*.* matches any hostname with a dot', () => {
    expect(ruleMatchesHost('example.com', { host: '*.*' })).toBe(true);
    expect(ruleMatchesHost('a.b.c', { host: '*.*' })).toBe(true);
    expect(ruleMatchesHost('localhost', { host: '*.*' })).toBe(false);
  });

  it('** and *** behave same as *', () => {
    expect(ruleMatchesHost('anything.com', { host: '**' })).toBe(true);
    expect(ruleMatchesHost('anything.com', { host: '***' })).toBe(true);
  });

  it('.* matches hostnames starting with dot (unlikely but safe)', () => {
    expect(ruleMatchesHost('.hidden', { host: '.*' })).toBe(true);
    expect(ruleMatchesHost('normal.com', { host: '.*' })).toBe(false);
  });

  it('*. matches hostnames ending with dot', () => {
    expect(ruleMatchesHost('example.', { host: '*.' })).toBe(true);
    expect(ruleMatchesHost('example.com', { host: '*.' })).toBe(false);
  });

  it('null/undefined host returns false', () => {
    expect(ruleMatchesHost('example.com', { host: null })).toBe(false);
    expect(ruleMatchesHost('example.com', { host: undefined })).toBe(false);
    expect(ruleMatchesHost('example.com', {})).toBe(false);
  });
});

describe('ruleMatchesHost — fragment edge cases', () => {
  it('@. matches hostnames containing a dot', () => {
    expect(ruleMatchesHost('example.com', { host: '@.' })).toBe(true);
    expect(ruleMatchesHost('localhost', { host: '@.' })).toBe(false);
  });

  it('@[ and @( are treated as literal characters', () => {
    expect(ruleMatchesHost('example.com', { host: '@[' })).toBe(false);
    expect(ruleMatchesHost('weird[host', { host: '@[' })).toBe(true);
  });
});

describe('ruleMatchesHost — fragment (@)', () => {
  it('@google matches any hostname containing "google"', () => {
    const rule = { host: '@google' };
    expect(ruleMatchesHost('www.google.com.tw', rule)).toBe(true);
    expect(ruleMatchesHost('mail.google.co.jp', rule)).toBe(true);
    expect(ruleMatchesHost('google.com', rule)).toBe(true);
    expect(ruleMatchesHost('mygoogle.com', rule)).toBe(true);
    expect(ruleMatchesHost('yahoo.com', rule)).toBe(false);
  });

  it('@.google. matches ".google." (dot-bounded)', () => {
    const rule = { host: '@.google.' };
    expect(ruleMatchesHost('www.google.com', rule)).toBe(true);
    expect(ruleMatchesHost('mail.google.co.jp', rule)).toBe(true);
    expect(ruleMatchesHost('google.com', rule)).toBe(false);   // no leading dot
    expect(ruleMatchesHost('mygoogle.com', rule)).toBe(false);  // no dot before google
  });

  it('@google. matches "google." (domain + dot)', () => {
    const rule = { host: '@google.' };
    expect(ruleMatchesHost('google.com', rule)).toBe(true);
    expect(ruleMatchesHost('www.google.com.tw', rule)).toBe(true);
    expect(ruleMatchesHost('mygoogle.net', rule)).toBe(true);
    expect(ruleMatchesHost('yahoo.com', rule)).toBe(false);
  });

  it('@.google matches ".google" (subdomain boundary)', () => {
    const rule = { host: '@.google' };
    expect(ruleMatchesHost('www.google.com', rule)).toBe(true);
    expect(ruleMatchesHost('mail.google.co.jp', rule)).toBe(true);
    expect(ruleMatchesHost('google.com', rule)).toBe(false);
  });

  it('@amazon.com matches hostname containing "amazon.com"', () => {
    const rule = { host: '@amazon.com' };
    expect(ruleMatchesHost('amazon.com', rule)).toBe(true);
    expect(ruleMatchesHost('www.amazon.com', rule)).toBe(true);
    expect(ruleMatchesHost('amazon.com.evil.com', rule)).toBe(true); // contains fragment
    expect(ruleMatchesHost('amazon.co.uk', rule)).toBe(false);
  });

  it('case-insensitive', () => {
    const rule = { host: '@Google' };
    expect(ruleMatchesHost('www.google.com', rule)).toBe(true);
    expect(ruleMatchesHost('WWW.GOOGLE.COM', rule)).toBe(true);
  });

  it('empty fragment @ matches everything', () => {
    const rule = { host: '@' };
    expect(ruleMatchesHost('example.com', rule)).toBe(true);
    expect(ruleMatchesHost('', rule)).toBe(true);
  });
});

describe('ruleMatchesHost — enabled field', () => {
  it('enabled: false skips', () => {
    expect(ruleMatchesHost('github.com', { host: 'github.com', enabled: false })).toBe(false);
  });

  it('enabled: true matches', () => {
    expect(ruleMatchesHost('github.com', { host: 'github.com', enabled: true })).toBe(true);
  });

  it('enabled: undefined (missing) defaults to active', () => {
    expect(ruleMatchesHost('github.com', { host: 'github.com' })).toBe(true);
  });

  it('enabled: null is not strictly false, so matches', () => {
    // enabled === false is the only skip condition
    expect(ruleMatchesHost('github.com', { host: 'github.com', enabled: null })).toBe(true);
  });

  it('enabled: 0 is not strictly false, so matches', () => {
    expect(ruleMatchesHost('github.com', { host: 'github.com', enabled: 0 })).toBe(true);
  });
});

describe('ruleMatchesHost — semicolon-delimited tokens', () => {
  it('matches when any exact, wildcard, or fragment token matches', () => {
    const rule = { host: '@youtube; *.yahoo; example.com' };
    expect(ruleMatchesHost('www.youtube.com', rule)).toBe(true);
    expect(ruleMatchesHost('video.yahoo', rule)).toBe(true);
    expect(ruleMatchesHost('example.com', rule)).toBe(true);
    expect(ruleMatchesHost('mozilla.org', rule)).toBe(false);
  });

  it('trims tokens and ignores empty token slots', () => {
    const rule = { host: ' ;  @media ; ; *.example.com  ' };
    expect(ruleMatchesHost('media.example', rule)).toBe(true);
    expect(ruleMatchesHost('docs.example.com', rule)).toBe(true);
    expect(ruleMatchesHost('other.test', rule)).toBe(false);
  });

  it('disabled multi-token rules never match', () => {
    expect(ruleMatchesHost('youtube.com', {
      host: '@youtube; *.yahoo',
      enabled: false,
    })).toBe(false);
  });
});

// ─── sortBySpecificity ──────────────────────────────────────────────

describe('sortBySpecificity', () => {
  it('more segments = higher specificity = first', () => {
    const rules = [
      { host: '*.com' },
      { host: 'www.github.com' },
      { host: '*.github.com' },
    ];
    const sorted = sortBySpecificity(rules);
    expect(sorted[0].host).toBe('www.github.com');
  });

  it('preserves insertion order for equal specificity', () => {
    const rules = [
      { host: 'a.com' },
      { host: 'b.com' },
    ];
    const sorted = sortBySpecificity(rules);
    expect(sorted.map(r => r.host)).toEqual(['a.com', 'b.com']);
  });

  it('empty array returns empty', () => {
    expect(sortBySpecificity([])).toEqual([]);
  });

  it('does not mutate original array', () => {
    const rules = [{ host: 'b.com' }, { host: 'a.b.com' }];
    const original = [...rules];
    sortBySpecificity(rules);
    expect(rules).toEqual(original);
  });

  it('strips wildcard prefix for segment count', () => {
    // *.a.b.com has 3 real segments (a.b.com), same as exact a.b.com
    const rules = [
      { host: '*.a.b.com' },
      { host: 'a.b.com' },
    ];
    const sorted = sortBySpecificity(rules);
    // equal specificity — order preserved
    expect(sorted.map(r => r.host)).toEqual(['*.a.b.com', 'a.b.com']);
  });

  it('strips fragment prefix for segment count', () => {
    // @amazon.com -> 2 segments, same as exact amazon.com
    const rules = [
      { host: 'a.b.c.com' },
      { host: '@amazon.com' },
    ];
    const sorted = sortBySpecificity(rules);
    expect(sorted[0].host).toBe('a.b.c.com'); // 4 segments > 2
  });

  it('fragment segment count based on dot-split', () => {
    const rules = [
      { host: '@amazon.co.uk' },
      { host: 'simple.com' },
    ];
    const sorted = sortBySpecificity(rules);
    // "amazon.co.uk" = 3 segments > "simple.com" = 2 segments
    expect(sorted[0].host).toBe('@amazon.co.uk');
  });

  it('uses the maximum specificity among semicolon-delimited tokens', () => {
    const rules = [
      { host: '*.com' },
      { host: '@broad; very.specific.example.com' },
    ];
    const sorted = sortBySpecificity(rules);
    expect(sorted[0].host).toBe('@broad; very.specific.example.com');
  });
});

// ─── match (integration) ────────────────────────────────────────────

describe('match', () => {
  const rules = [
    { host: 'github.com', cookieStoreId: 'firefox-container-1' },
    { host: '*.github.com', cookieStoreId: 'firefox-container-1' },
    { host: '@amazon.co', cookieStoreId: 'firefox-container-2' },
    { host: 'disabled.com', cookieStoreId: 'firefox-container-3', enabled: false },
  ];

  // basic matching
  it('matches exact URL', () => {
    const result = match('https://github.com/some/path', rules);
    expect(result).not.toBeNull();
    expect(result.cookieStoreId).toBe('firefox-container-1');
  });

  it('matches wildcard URL', () => {
    const result = match('https://docs.github.com/en', rules);
    expect(result).not.toBeNull();
    expect(result.cookieStoreId).toBe('firefox-container-1');
  });

  it('matches fragment URL', () => {
    const result = match('https://amazon.co.uk/product/123', rules);
    expect(result).not.toBeNull();
    expect(result.cookieStoreId).toBe('firefox-container-2');
  });

  // no match
  it('returns null for unmatched URL', () => {
    expect(match('https://example.com', rules)).toBeNull();
  });

  it('skips disabled rules', () => {
    expect(match('https://disabled.com', rules)).toBeNull();
  });

  it('returns null for unparseable URL', () => {
    expect(match('not-a-url', rules)).toBeNull();
  });

  it('returns null for empty rules', () => {
    expect(match('https://github.com', [])).toBeNull();
  });

  // specificity
  it('most specific rule wins (exact over wildcard)', () => {
    const overlapping = [
      { host: '*.example.com', cookieStoreId: 'firefox-container-1' },
      { host: 'sub.example.com', cookieStoreId: 'firefox-container-2' },
    ];
    const result = match('https://sub.example.com', overlapping);
    expect(result.cookieStoreId).toBe('firefox-container-2');
  });

  it('more-specific wildcard wins over broad wildcard', () => {
    const overlapping = [
      { host: '*.com', cookieStoreId: 'broad' },
      { host: '*.github.com', cookieStoreId: 'specific' },
    ];
    const result = match('https://docs.github.com', overlapping);
    expect(result.cookieStoreId).toBe('specific');
  });

  // URL variations
  it('matches URL with port', () => {
    const result = match('https://github.com:8443/path', rules);
    expect(result).not.toBeNull();
    expect(result.cookieStoreId).toBe('firefox-container-1');
  });

  it('matches URL with auth info', () => {
    const result = match('https://user:pass@github.com/path', rules);
    expect(result).not.toBeNull();
    expect(result.cookieStoreId).toBe('firefox-container-1');
  });

  it('matches URL with fragment', () => {
    const result = match('https://github.com/page#section', rules);
    expect(result).not.toBeNull();
    expect(result.cookieStoreId).toBe('firefox-container-1');
  });

  it('matches URL with query string', () => {
    const result = match('https://github.com/search?q=test&lang=js', rules);
    expect(result).not.toBeNull();
    expect(result.cookieStoreId).toBe('firefox-container-1');
  });

  it('matches http (not just https)', () => {
    const result = match('http://github.com/', rules);
    expect(result).not.toBeNull();
    expect(result.cookieStoreId).toBe('firefox-container-1');
  });

  // edge cases
  it('returns null for about: URL', () => {
    expect(match('about:blank', rules)).toBeNull();
  });

  it('returns null for data: URL', () => {
    expect(match('data:text/html,<h1>hi</h1>', rules)).toBeNull();
  });

  it('handles all rules disabled', () => {
    const allDisabled = [
      { host: 'github.com', cookieStoreId: 'c1', enabled: false },
      { host: '*.github.com', cookieStoreId: 'c1', enabled: false },
    ];
    expect(match('https://github.com', allDisabled)).toBeNull();
  });

  it('first match wins among equal specificity', () => {
    const dupes = [
      { host: 'github.com', cookieStoreId: 'first' },
      { host: 'github.com', cookieStoreId: 'second' },
    ];
    const result = match('https://github.com', dupes);
    expect(result.cookieStoreId).toBe('first');
  });

  it('exact vs fragment: both match, higher specificity wins', () => {
    const mixed = [
      { host: '@github.com', cookieStoreId: 'fragment' },
      { host: 'github.com', cookieStoreId: 'exact' },
    ];
    const result = match('https://github.com', mixed);
    // same segment count, insertion order preserved → fragment first
    expect(result.cookieStoreId).toBe('fragment');
  });

  it('multi-string rule matches any token and can beat broad rules by max specificity', () => {
    const rules = [
      { host: '*.com', cookieStoreId: 'broad' },
      { host: '@youtube; studio.youtube.com', cookieStoreId: 'media' },
    ];
    expect(match('https://studio.youtube.com', rules).cookieStoreId).toBe('media');
    expect(match('https://www.youtube.com', rules).cookieStoreId).toBe('media');
  });

  it('ranks multi-string rules by the matched token specificity only', () => {
    const rules = [
      { host: 'github.com; *', cookieStoreId: 'mixed' },
      { host: 'example.com', cookieStoreId: 'exact' },
    ];
    expect(match('https://example.com', rules).cookieStoreId).toBe('exact');
    expect(match('https://github.com', rules).cookieStoreId).toBe('mixed');
  });
});

// ─── match — IPv4 ───────────────────────────────────────────────────

describe('match — IPv4 addresses', () => {
  it('exact rule matches IPv4', () => {
    const rules = [{ host: '192.168.1.1', cookieStoreId: 'c1' }];
    expect(match('https://192.168.1.1/', rules).cookieStoreId).toBe('c1');
  });

  it('exact rule with port in URL still matches', () => {
    const rules = [{ host: '192.168.1.1', cookieStoreId: 'c1' }];
    expect(match('https://192.168.1.1:3000/path', rules).cookieStoreId).toBe('c1');
  });

  it('glob *.168.1.1 matches IPv4 (user intent)', () => {
    const rules = [{ host: '*.168.1.1', cookieStoreId: 'c1' }];
    const result = match('https://192.168.1.1/', rules);
    expect(result).not.toBeNull();
  });

  it('fragment matches IPv4', () => {
    const rules = [{ host: '@192.168.', cookieStoreId: 'c1' }];
    expect(match('https://192.168.1.1/', rules).cookieStoreId).toBe('c1');
    expect(match('https://192.168.99.99/', rules).cookieStoreId).toBe('c1');
    expect(match('https://10.0.0.1/', rules)).toBeNull();
  });

  it('127.0.0.1 exact match', () => {
    const rules = [{ host: '127.0.0.1', cookieStoreId: 'c1' }];
    expect(match('http://127.0.0.1/', rules).cookieStoreId).toBe('c1');
  });
});

// ─── match — IPv6 ───────────────────────────────────────────────────

describe('match — IPv6 addresses', () => {
  it('exact rule matches IPv6 loopback', () => {
    // URL("https://[::1]/").hostname => "[::1]" in some runtimes, "::1" in others
    const hostname = new URL('https://[::1]/').hostname;
    const rules = [{ host: hostname, cookieStoreId: 'c1' }];
    expect(match('https://[::1]/', rules).cookieStoreId).toBe('c1');
  });
});

// ─── match — IDN / punycode ─────────────────────────────────────────

describe('match — IDN / punycode', () => {
  it('punycode rule matches IDN URL', () => {
    // URL constructor converts IDN -> punycode, so rule must use punycode
    const rules = [{ host: 'xn--r8jz45g.jp', cookieStoreId: 'c1' }];
    expect(match('https://例え.jp/', rules).cookieStoreId).toBe('c1');
  });

  it('IDN rule does NOT match IDN URL (punycode mismatch)', () => {
    // User writes Unicode rule, but hostname is punycode -> no match
    const rules = [{ host: '例え.jp', cookieStoreId: 'c1' }];
    expect(match('https://例え.jp/', rules)).toBeNull();
  });

  it('wildcard punycode rule matches IDN subdomain', () => {
    const rules = [{ host: '*.xn--r8jz45g.jp', cookieStoreId: 'c1' }];
    expect(match('https://www.例え.jp/', rules)).not.toBeNull();
  });

  it('fragment can match punycode', () => {
    const rules = [{ host: '@xn--', cookieStoreId: 'c1' }];
    expect(match('https://例え.jp/', rules).cookieStoreId).toBe('c1');
  });
});

// ─── match — localhost / special hosts ──────────────────────────────

describe('match — localhost and special hosts', () => {
  it('exact localhost rule', () => {
    const rules = [{ host: 'localhost', cookieStoreId: 'c1' }];
    expect(match('http://localhost/', rules).cookieStoreId).toBe('c1');
    expect(match('http://localhost:3000/', rules).cookieStoreId).toBe('c1');
  });

  it('wildcard *.localhost does not match bare localhost', () => {
    const rules = [{ host: '*.localhost', cookieStoreId: 'c1' }];
    expect(match('http://localhost/', rules)).toBeNull();
  });
});

// --- targetContainer ---

describe('targetContainer', () => {
  const { targetContainer } = require('../matcher.js');
  const identities = [
    { cookieStoreId: 'firefox-default', name: 'No Container' },
    { cookieStoreId: 'firefox-container-1', name: 'Work' },
    { cookieStoreId: 'firefox-container-2', name: 'Shopping' },
  ];

  it('finds existing container', () => {
    const rule = { cookieStoreId: 'firefox-container-1' };
    expect(targetContainer(rule, identities)).toEqual({ cookieStoreId: 'firefox-container-1', name: 'Work' });
  });

  it('returns undefined for deleted container', () => {
    const rule = { cookieStoreId: 'firefox-container-99' };
    expect(targetContainer(rule, identities)).toBeUndefined();
  });
});

// --- hasRules ---

describe('hasRules', () => {
  const { hasRules } = require('../matcher.js');
  const rules = [
    { host: 'github.com', cookieStoreId: 'firefox-container-1' },
    { host: 'amazon.com', cookieStoreId: 'firefox-container-2' },
  ];

  it('returns true when container has rules', () => {
    expect(hasRules('firefox-container-1', rules)).toBe(true);
  });

  it('returns false when container has no rules', () => {
    expect(hasRules('firefox-container-99', rules)).toBe(false);
  });

  it('returns false for empty rules', () => {
    expect(hasRules('firefox-container-1', [])).toBe(false);
  });
});

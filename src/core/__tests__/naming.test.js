import { formatName } from '../naming.js';

// Schema: Container.schema.json x-naming

// ─── formatName — standard ──────────────────────────────────────────

describe('formatName — variable replacement', () => {
  it('replaces {fqdn} with hostname', () => {
    expect(formatName('{fqdn}', 'https://www.example.com/path')).toBe('www.example.com');
  });

  it('replaces {domain} with second-level domain', () => {
    expect(formatName('{domain}', 'https://www.example.com')).toBe('example');
  });

  it('replaces {tld}', () => {
    expect(formatName('{tld}', 'https://www.example.com')).toBe('com');
  });

  it('replaces {host} same as {fqdn}', () => {
    expect(formatName('{host}', 'https://example.com')).toBe('example.com');
  });

  it('replaces multiple different variables', () => {
    expect(formatName('{domain}-{tld}', 'https://example.com')).toBe('example-com');
  });

  it('replaces same variable used twice', () => {
    expect(formatName('{fqdn}/{fqdn}', 'https://example.com')).toBe('example.com/example.com');
  });

  it('adjacent variables without separator', () => {
    expect(formatName('{domain}{tld}', 'https://example.com')).toBe('examplecom');
  });

  it('{ms} returns timestamp string', () => {
    const result = formatName('{ms}', 'https://example.com');
    expect(result).toMatch(/^\d+$/);
  });
});

describe('formatName — unknown/invalid variables', () => {
  it('keeps unknown variables as-is', () => {
    expect(formatName('{unknown}', 'https://example.com')).toBe('{unknown}');
  });

  it('nested braces: {{fqdn}} partially replaced', () => {
    // regex matches inner {fqdn}, outer braces stay
    expect(formatName('{{fqdn}}', 'https://example.com')).toBe('{example.com}');
  });

  it('empty braces {} not matched (no key)', () => {
    expect(formatName('{}', 'https://example.com')).toBe('{}');
  });
});

describe('formatName — invalid URL fallback', () => {
  it('returns template for garbage URL', () => {
    expect(formatName('{fqdn}', 'not-a-url')).toBe('{fqdn}');
  });

  it('returns template for empty URL', () => {
    expect(formatName('{fqdn}', '')).toBe('{fqdn}');
  });

  it('returns template for about:blank', () => {
    expect(formatName('{fqdn}', 'about:blank')).toBe('{fqdn}');
  });

  it('returns template for data: URL', () => {
    expect(formatName('{fqdn}', 'data:text/html,hi')).toBe('{fqdn}');
  });
});

describe('formatName — empty/plain template', () => {
  it('empty template returns empty string', () => {
    expect(formatName('', 'https://example.com')).toBe('');
  });

  it('template without variables returned as-is', () => {
    expect(formatName('fixed-name', 'https://example.com')).toBe('fixed-name');
  });
});

describe('formatName — special URL types', () => {
  it('IPv4: {fqdn} returns IP, {domain} falls back to hostname', () => {
    expect(formatName('{fqdn}', 'https://192.168.1.1/')).toBe('192.168.1.1');
    // IPv4 has no domain — falls back to hostname
    expect(formatName('{domain}', 'https://192.168.1.1/')).toBe('192.168.1.1');
  });

  it('IPv6: {fqdn} returns bare address', () => {
    const result = formatName('{fqdn}', 'https://[::1]/');
    expect(['::1', '[::1]']).toContain(result);
  });

  it('IDN: {fqdn} returns punycode', () => {
    expect(formatName('{fqdn}', 'https://例え.jp/')).toBe('xn--r8jz45g.jp');
  });

  it('file:///: empty hostname triggers fallback', () => {
    // extractHostname returns "" which is falsy -> returns template
    expect(formatName('{fqdn}', 'file:///etc/passwd')).toBe('{fqdn}');
  });

  it('URL with port: port stripped', () => {
    expect(formatName('{fqdn}', 'https://example.com:8080/')).toBe('example.com');
  });

  it('localhost: {domain} and {tld} both return "localhost"', () => {
    expect(formatName('{domain}', 'http://localhost/')).toBe('localhost');
    expect(formatName('{tld}', 'http://localhost/')).toBe('localhost');
  });
});

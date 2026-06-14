describe('Tabs', () => {

  let Tabs;

  beforeEach(async () => {
    vi.resetModules();
    global.browser = {
      tabs: {

        get: vi.fn((tabId) => new Promise((resolve) =>
          resolve({
            id: tabId,
            cookieStoreId: 'cookie store',
          }),
        )),

        create: vi.fn((options) => new Promise((resolve) =>
          resolve({
            ...options,
          })
        )),

        remove: vi.fn(() => new Promise((resolve) => resolve())),

        query: vi.fn((queryInfo) => new Promise((resolve) =>
          resolve({
            ...queryInfo,
          })
        )),
      },
    };

    const mod = await import('../index.js');
    Tabs = mod.default;
  });

  it('should get tab by id', () => {
    expect.assertions(1);
    return Tabs.get(42).then((tab) => {
      expect(tab).toEqual({
        id: 42,
        cookieStoreId: 'cookie store',
      });
    });
  });

  it('should create a tab', () => {
    const options = {
      url: 'https://url.com',
      cookieStoreId: 'cookie store',
      index: 41,
    };
    expect.assertions(1);
    return Tabs.create(options).then((tab) => {
      expect(tab).toEqual(options);
    });
  });

  it('should remove a tab', () => {
    expect.assertions(1);
    return Tabs.remove(42).then((tab) => {
      expect(tab).toBeUndefined();
    });
  });

  it('should query tabs', () => {
    const queryInfo = {
      active: true,
    };
    expect.assertions(1);
    return Tabs.query(queryInfo).then((tab) => {
      expect(tab).toEqual(queryInfo);
    });
  });

});

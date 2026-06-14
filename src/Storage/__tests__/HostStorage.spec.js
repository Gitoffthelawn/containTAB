describe('HostStorage', () => {

  let HostStorage;

  beforeEach(async () => {
    vi.resetModules();
    global.browser = {
      storage: {
        local: {

          get: vi.fn(() => new Promise((resolve) =>
            resolve({
              'map=example.com': {
                host: 'example.com',
                container: 'example',
                enabled: true,
              },
              'map=kinte.sh/*': {
                host: 'kinte.sh/*',
                container: 'personal',
                enabled: true,
              },
              'map=*.example.com': {
                host: '*.example.com',
                container: 'example',
                enabled: true,
              },
              'map=*.kinte.sh/*': {
                host: '*.kinte.sh/*',
                container: 'personal',
                enabled: true,
              },
              'map=test.example.com/here': {
                host: 'test.example.com/here',
                container: 'example',
                enabled: true,
              },
              'map=test.kinte.sh/here': {
                host: 'test.kinte.sh/here',
                container: 'personal',
                enabled: true,
              },
            }),
          )),

          set: vi.fn((keys) => new Promise((resolve) => resolve(keys))),

          remove: vi.fn((key) => new Promise((resolve) => resolve({key}))),

          clear: vi.fn(() => new Promise((resolve) => resolve())),

        },

        onChanged: {
          addListener: vi.fn(() => {}),
        },
      },
    };

    const mod = await import('../HostStorage.js');
    HostStorage = mod.default;
  });

  it('should get all host maps', () => {
    expect.assertions(1);
    return HostStorage.getAll().then((results) => {
      expect(results).toEqual({
        'example.com': {
          host: 'example.com',
          container: 'example',
          enabled: true,
        },
        'kinte.sh/*': {
          host: 'kinte.sh/*',
          container: 'personal',
          enabled: true,
        },
        '*.example.com': {
          host: '*.example.com',
          container: 'example',
          enabled: true,
        },
        '*.kinte.sh/*': {
          host: '*.kinte.sh/*',
          container: 'personal',
          enabled: true,
        },
        'test.example.com/here': {
          host: 'test.example.com/here',
          container: 'example',
          enabled: true,
        },
        'test.kinte.sh/here': {
          host: 'test.kinte.sh/here',
          container: 'personal',
          enabled: true,
        },
      });
    });
  });

  it('should get by key', () => {
    expect.assertions(2);
    return Promise.all([
      HostStorage.get('example.com').then((result) => {
        expect(result).toEqual({
          host: 'example.com',
          container: 'example',
          enabled: true,
        });
      }),
      HostStorage.get('kinte.sh/*').then((result) => {
        expect(result).toEqual({
          host: 'kinte.sh/*',
          container: 'personal',
          enabled: true,
        });
      }),
    ]);
  });

  it('should set all', () => {
    const hostMaps = {
      'example.com': {
        host: 'example.com',
        container: 'example',
        enabled: true,
      },
      'kinte.sh': {
        host: 'kinte.sh',
        container: 'personal',
        enabled: true,
      },
    };

    expect.assertions(1);
    return HostStorage.setAll(hostMaps).then((keysO) => {
      expect(keysO).toEqual({
        'map=example.com': {
          host: 'example.com',
          container: 'example',
          enabled: true,
        },
        'map=kinte.sh': {
          host: 'kinte.sh',
          container: 'personal',
          enabled: true,
        },
      });
    });
  });

  it('should set one entry', () => {
    const hostMap = {
      host: 'example.com',
      container: 'example',
      enabled: true,
    };

    expect.assertions(3);
    return HostStorage.set(hostMap).then((keysO) => {
      const keys = Object.keys(keysO);
      expect(keys.length).toEqual(1);
      expect(keys[0]).toEqual('map=example.com');
      expect(keysO[keys[0]]).toEqual({
        host: 'example.com',
        container: 'example',
        enabled: true,
      });
    });
  });

  it('should remove one entry', () => {
    expect.assertions(1);
    return HostStorage.remove('example.com').then(({key}) => {
      expect(key).toEqual(['map=example.com']);
    });
  });

  it('should clear the storage', () => {
    expect.assertions(1);
    return HostStorage.clear().then((result) => {
      expect(result).toBeUndefined();
    });
  });

  it('should only notify listeners for host map changes', () => {
    const fn = vi.fn();
    HostStorage.addOnChangedListener(fn);
    const listener = browser.storage.onChanged.addListener.mock.calls[0][0];

    listener({
      config: { newValue: { theme: 'dark' } },
      'containers.firefox-container-1': { newValue: { lifetime: 'forever' } },
    }, 'local');
    expect(fn).not.toHaveBeenCalled();

    listener({
      'map=example.com': {
        newValue: {
          host: 'example.com',
          container: 'example',
          enabled: true,
        },
      },
    }, 'local');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({
      'example.com': {
        newValue: {
          host: 'example.com',
          container: 'example',
          enabled: true,
        },
      },
    }, 'local');
  });

});

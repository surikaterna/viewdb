const { BaselineCache, encodedBytes, normalizeDocument } = require('../../dist/deltaCache');

function document(id, version, extra = {}) {
  return { _id: id, version, nested: { array: [1, { keep: true }] }, ...extra };
}

describe('Delta baseline cache bounds', () => {
  it('isolates snapshots and scopes, replaces equal versions, and rejects older asynchronous results', () => {
    const cache = new BaselineCache();
    const original = document('a', 2);
    cache.set('one', original);
    cache.set('two', document('a', 9));
    original.nested.array[1].keep = false;
    expect(cache.get('one', 'a')).toEqual(document('a', 2));
    cache.set('one', document('a', 2, { authoritative: true }));
    cache.set('one', document('a', 1));
    expect(cache.get('one', 'a')).toEqual(document('a', 2, { authoritative: true }));
    cache.clear('one');
    expect(cache.get('one', 'a')).toBeUndefined();
    expect(cache.get('two', 'a')).toEqual(document('a', 9));
    expect(cache.size).toBe(1);
    expect(cache.bytes).toBe(encodedBytes(document('a', 9)));
    cache.clear();
    expect(cache.bytes).toBe(0);
    expect(cache.size).toBe(0);
  });

  it('evicts least recently used documents across scopes within a shared byte and entry budget', () => {
    const a = document('a', 1, { unicode: '😀å' });
    const b = document('b', 1, { unicode: '😀å' });
    const c = document('c', 1, { unicode: '😀å' });
    const bytes = Buffer.byteLength(JSON.stringify(a));
    expect(encodedBytes(a)).toBe(bytes);
    const cache = new BaselineCache({ maxBytes: bytes * 2, maxEntries: 2 });
    cache.set('one', a);
    cache.set('two', b);
    cache.get('one', 'a');
    cache.set('three', c);
    expect(cache.get('two', 'b')).toBeUndefined();
    expect(cache.get('one', 'a')).toEqual(a);
    expect(cache.get('three', 'c')).toEqual(c);
    expect(cache.size).toBe(2);
    expect(cache.bytes).toBe(bytes * 2);
    cache.set('one', document('a', 2, { oversized: 'x'.repeat(bytes * 3) }));
    expect(cache.get('one', 'a')).toBeUndefined();
    expect(cache.bytes).toBe(bytes);
  });

  it.each([{ maxBytes: 0 }, { maxEntries: 0 }])('allows clients to disable retention with %j', (limits) => {
    const cache = new BaselineCache(limits);
    cache.set('observer', document('a', 1));
    expect(cache.get('observer', 'a')).toBeUndefined();
    expect(cache.size).toBe(0);
    expect(cache.bytes).toBe(0);
  });

  it.each([undefined, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '2'])('does not cache invalid version %s', (version) => {
    const cache = new BaselineCache();
    cache.set('observer', document('a', 1));
    cache.set('observer', document('a', version));
    expect(cache.get('observer', 'a')).toBeUndefined();
  });

  it('rejects lossy, cyclic, sparse, accessor, and prototype-sensitive patch bases', () => {
    const cyclic = document('a', 1);
    cyclic.nested.self = cyclic;
    const sparse = [];
    sparse.length = 2;
    const accessor = document('a', 1);
    Object.defineProperty(accessor, 'dangerous', {
      enumerable: true,
      get() {
        throw new Error('must not execute');
      }
    });
    for (const value of [
      cyclic,
      accessor,
      document('a', 1, { unsupported: undefined }),
      document('a', 1, { unsupported: BigInt(1) }),
      document('a', 1, { unsupported: new Date() }),
      document('a', 1, { unsupported: sparse }),
      JSON.parse('{"_id":"a","version":1,"nested":{"__proto__":{"polluted":true}}}')
    ])
      expect(normalizeDocument(value)).toBeUndefined();
    expect({}.polluted).toBeUndefined();
  });
});

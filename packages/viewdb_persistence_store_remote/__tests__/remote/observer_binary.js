const { FakeClient, observeWithState } = require('./delta_client_fixture.cjs');
const { cloneFullDocument } = require('../../dist/fullDocument');
const { normalizeDocument } = require('../../dist/deltaCache');

describe('Binary full observer payloads', () => {
  it('preserves legacy binary callback values without sharing the incoming storage', () => {
    const client = new FakeClient();
    const incoming = { _id: 'a', bytes: Buffer.from([1, 2, 3]), array: new Uint8Array([4, 5]).buffer };
    let delivered;
    const observer = observeWithState(client, {
      changed(_previous, document) {
        delivered = document;
        expect(Buffer.isBuffer(document.bytes)).toBe(true);
        expect(document.array instanceof ArrayBuffer).toBe(true);
        document.bytes[0] = 99;
        new Uint8Array(document.array)[0] = 88;
      }
    });
    try {
      client.send({ handle: 'legacy', changes: [{ i: { r: [{ _id: 'a' }] } }] });
      client.send({ changes: [{ c: { o: null, n: incoming, i: 0 } }] });
      expect([...incoming.bytes]).toEqual([1, 2, 3]);
      expect([...new Uint8Array(incoming.array)]).toEqual([4, 5]);
      expect([...delivered.bytes]).toEqual([99, 2, 3]);
      expect([...new Uint8Array(delivered.array)]).toEqual([88, 5]);
    } finally {
      observer.stop();
    }
  });

  it('serializes dates and undefined fields while retaining isolated binary recovery data', () => {
    const backing = new Uint8Array([0, 10, 20, 0]);
    const source = {
      _id: 'a',
      version: 1,
      bytes: Buffer.from([7, 8]),
      view: new DataView(backing.buffer, 1, 2),
      typed: new Uint16Array([256, 512]),
      date: new Date('2024-01-01T00:00:00.000Z'),
      omitted: undefined
    };
    const wire = cloneFullDocument(source);
    expect(wire.date).toBe('2024-01-01T00:00:00.000Z');
    expect(Object.hasOwn(wire, 'omitted')).toBe(false);
    expect(Buffer.isBuffer(wire.bytes)).toBe(true);
    expect(wire.view instanceof DataView).toBe(true);
    expect(wire.view.byteLength).toBe(2);
    expect(wire.view.getUint8(0)).toBe(10);
    expect([...wire.typed]).toEqual([256, 512]);
    wire.bytes[0] = 9;
    wire.view.setUint8(0, 90);
    wire.typed[0] = 99;
    expect([...source.bytes]).toEqual([7, 8]);
    expect([...backing]).toEqual([0, 10, 20, 0]);
    expect([...source.typed]).toEqual([256, 512]);
    expect(normalizeDocument(wire)).toBeUndefined();
  });
});

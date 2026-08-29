import { observable, isObservable, shadowObservable } from '../../main';

const TypedArrays: Array<new (length: number) => ArrayBufferView> = [
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  BigInt64Array,
  BigUint64Array,
];
if (typeof Float16Array === 'function') {
  TypedArrays.push(Float16Array);
}

describe('typed arrays are not instrumented (#190)', () => {
  for (const TypedArray of TypedArrays) {
    test(`${TypedArray.name} is returned raw; length and methods stay usable`, () => {
      const raw = new TypedArray(2);
      const wrapped = observable(raw);
      expect(wrapped).toBe(raw);
      expect(isObservable(wrapped)).toBe(false);
      expect(raw.length).toBe(2);
      if ('fill' in raw && typeof (raw as { fill: Function }).fill === 'function') {
        const fillValue = raw instanceof BigInt64Array || raw instanceof BigUint64Array ? 0n : 0;
        expect(() =>
          (raw as { fill: (v: number | bigint) => unknown }).fill(fillValue)
        ).not.toThrow();
      }
    });
  }

  test('DataView is returned raw (ArrayBuffer.isView, same skip as TypedArray)', () => {
    const raw = new DataView(new ArrayBuffer(8));
    const wrapped = observable(raw);
    expect(wrapped).toBe(raw);
    expect(isObservable(wrapped)).toBe(false);
    expect(raw.byteLength).toBe(8);
    expect(() => raw.setUint8(0, 7)).not.toThrow();
    expect(raw.getUint8(0)).toBe(7);
  });

  test('shadowObservable also leaves TypedArray raw', () => {
    const raw = new Uint8Array([1, 2]);
    expect(shadowObservable(raw)).toBe(raw);
    expect(isObservable(raw)).toBe(false);
  });

  test('Uint8Array subclass is still a view and is not wrapped', () => {
    class MyBytes extends Uint8Array {}
    const raw = new MyBytes([1, 2, 3]);
    expect(observable(raw)).toBe(raw);
    expect(isObservable(raw)).toBe(false);
    expect(raw.length).toBe(3);
    expect(() => raw.fill(0)).not.toThrow();
  });
});

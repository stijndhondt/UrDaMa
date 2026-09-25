import { derived, source } from './reactive';

describe('source / derived (the dependency engine, ADR 0003)', () => {
  it('runs in Node without a DOM', () => {
    expect('document' in globalThis).toBe(false);
    expect('window' in globalThis).toBe(false);
  });

  it('recalculates a Derived value only when it is read after its Source data changed', () => {
    const width = source('Keuken · width', 2670);
    let runs = 0;
    const area = derived('Keuken · Net floor area', () => {
      runs++;
      return (width() * 3730) / 1e6;
    });

    expect(runs).toBe(0);
    expect(area()).toBeCloseTo(9.9591, 4);
    width.set(2700);
    expect(runs).toBe(1);
    expect(area()).toBeCloseTo(10.071, 4);
    expect(area()).toBeCloseTo(10.071, 4);
    expect(runs).toBe(2);
  });
});

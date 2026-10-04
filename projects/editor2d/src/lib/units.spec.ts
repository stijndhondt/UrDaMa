import { parseLength } from './units';

describe('parseLength (typed lengths in the editor)', () => {
  // Every entry field takes mm; a typed unit (m, cm) always wins.
  it.each([
    ['3730', 3730],
    ['2.67 m', 2670],
    ['3,73 m', 3730],
    ['373 cm', 3730],
    ['373cm', 3730],
    ['140 mm', 140],
    ['140', 140],
    ['20', 20],
    ['50', 50],
    ['12m', 12000],
    ['884,5', 884.5],
  ])('reads %s as %d mm', (text, mm) => {
    expect(parseLength(text)).toBe(mm);
  });

  it.each(['', 'abc', '3.7.3', '-2', '0'])('rejects %j', (text) => {
    expect(parseLength(text)).toBeNull();
  });
});

describe('parseLength for a height that may be 0 (a sill on the floor)', () => {
  it.each([
    ['0', 0],
    ['0 mm', 0],
    ['0,00', 0],
    ['900', 900],
    ['0.9 m', 900],
  ])('reads %s as %d mm', (text, mm) => {
    expect(parseLength(text, { orZero: true })).toBe(mm);
  });

  it.each(['', 'abc', '-2'])('rejects %j', (text) => {
    expect(parseLength(text, { orZero: true })).toBeNull();
  });
});

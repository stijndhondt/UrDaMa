import { parseLength } from './units';

describe('parseLength (typed lengths in the editor)', () => {
  it.each([
    ['3.73', 3730],
    ['3,73', 3730],
    ['2.67 m', 2670],
    ['3730', 3730],
    ['373 cm', 3730],
    ['373cm', 3730],
    ['140 mm', 140],
    ['0.14', 140],
    ['50', 50000],
    ['51', 51],
    ['12m', 12000],
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
    ['0.9', 900],
  ])('reads %s as %d mm', (text, mm) => {
    expect(parseLength(text, { orZero: true })).toBe(mm);
  });

  it.each(['', 'abc', '-2'])('rejects %j', (text) => {
    expect(parseLength(text, { orZero: true })).toBeNull();
  });
});

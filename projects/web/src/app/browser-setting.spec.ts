import { readJson, readSetting, writeSetting } from './browser-setting';

describe('browser settings under the new name', () => {
  beforeEach(() => localStorage.clear());

  it('carries over a setting kept under the earlier name, and writes the new one', () => {
    localStorage.setItem('lakudemis.theme', 'dark');
    expect(readSetting('urdama.theme', ['light', 'dark'] as const)).toBe('dark');
    writeSetting('urdama.theme', 'light');
    expect(readSetting('urdama.theme', ['light', 'dark'] as const)).toBe('light');
    expect(localStorage.getItem('lakudemis.theme')).toBe('dark');
  });

  it('carries over the Opening library', () => {
    localStorage.setItem('lakudemis.library', JSON.stringify([{ id: 'a' }]));
    expect(readJson('urdama.library')).toEqual([{ id: 'a' }]);
  });
});

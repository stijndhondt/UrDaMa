import {
  counterIds,
  createProject,
  drawRoom,
  ProjectStore,
  type LevelId,
  type Message,
  type Wall,
} from '@urdama/core';
import type { EditorHost, Selection } from '../host';
import { TypedInput } from '../typed-input';
import { View } from '../view';
import { doubleClickOpensTypes } from '../plan-editor';
import { OpeningTool } from './opening-tool';
import type { PointerInfo, ToolContext } from './tool';

/** A 5 × 4 m Room, and the Window tool on a plan host that records what it is asked. */
function windowTool() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'G' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  store.run(drawRoom, {
    level,
    from: { x: 0, y: 0 },
    to: { x: 5000, y: 4000 },
    size: 'inside',
    name: 'Room 1',
  });
  const refusals: Message[] = [];
  let selection: readonly Selection[] = [];
  const host = {
    store,
    level: () => level,
    text: (key: string) => key,
    format: { length: (mm: number) => `${mm}`, area: (mm2: number) => `${mm2}` },
    nextRoomName: () => 'Room 2',
    selection: () => selection,
    select: (s: readonly Selection[]) => (selection = s),
    refused: (reason: Message) => refusals.push(reason),
  } satisfies EditorHost;
  const ctx: ToolContext = {
    host,
    view: new View(),
    typed: new TypedInput(document.body),
    invalidate: () => undefined,
  };
  const tool = new OpeningTool(ctx, 'window');
  const wall = Object.values(store.model().walls).find(
    (w: Wall) => w.start.y === 4000 && w.end.y === 4000,
  )!;
  /** A click at x on the bottom Wall, inside its thickness. */
  const click = (x: number) => {
    const p: PointerInfo = {
      model: { x, y: 4070 },
      screen: ctx.view.toScreen({ x, y: 4070 }),
      shift: false,
      ctrl: false,
      alt: false,
    };
    tool.pointerMove(p);
    tool.pointerDown(p);
    tool.pointerUp();
  };
  return { store, wall, refusals, click };
}

describe('a double click on a placed Opening (#9 review)', () => {
  it('opens its types with Select and the Opening tools, not while drawing Rooms or Walls', () => {
    expect(doubleClickOpensTypes('select')).toBe(true);
    expect(doubleClickOpensTypes('window')).toBe(true);
    expect(doubleClickOpensTypes('garageDoor')).toBe(true);
    expect(doubleClickOpensTypes('room')).toBe(false);
    expect(doubleClickOpensTypes('wall')).toBe(false);
  });

  it("with the Window tool, its clicks on the window don't place another or say no", () => {
    const { store, refusals, click } = windowTool();
    click(2500);
    expect(Object.keys(store.model().openings)).toHaveLength(1);
    // The two clicks of a double click on that window.
    click(2500);
    click(2500);
    expect(Object.keys(store.model().openings)).toHaveLength(1);
    expect(refusals).toEqual([]);
  });
});

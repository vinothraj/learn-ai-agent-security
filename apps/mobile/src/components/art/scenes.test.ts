import { contentPack } from '@laas/content';
import { describe, expect, it, vi } from 'vitest';

// Only the id tables are under test; the drawing primitives are never rendered here.
vi.mock('react-native-svg', () => {
  const stub = () => null;
  return { default: stub, Circle: stub, Ellipse: stub, G: stub, Line: stub, Path: stub, Polygon: stub, Polyline: stub, Rect: stub };
});

const { SCENE_IDS } = await import('./scenes');

describe('topic illustrations', () => {
  it('give every roadmap its own scene', () => {
    expect(contentPack.roadmaps.map((r) => r.id).sort()).toEqual([...SCENE_IDS.roadmaps].sort());
  });
  it('give every lesson its own scene (no roadmap fallback)', () => {
    const missing = contentPack.lessons.map((l) => l.id).filter((id) => !SCENE_IDS.lessons.includes(id));
    expect(missing).toEqual([]);
  });
  it('map every lab to an existing lesson scene', () => {
    const labs = contentPack.labs.map((l) => l.id);
    expect(labs.filter((id) => !SCENE_IDS.labs.includes(id))).toEqual([]);
  });
});

/**
 * The read-only 3D view (Slice 1 spec, "3D view"): all Levels stacked, an orthographic camera
 * that orbits, six camera presets, show / hide per Level, and click to select.
 *
 * Plan millimetres (x right, y down, z up) map to three.js metres with Y up: (x, z, y) / 1000.
 */
import {
  AmbientLight,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { LevelId, OpeningPartKind, SolidRef } from '@urdama/core';
import type { ElementMesh } from './solid-kernel';

/** The element a mesh shows, without its geometry. */
const solidRefOf = (m: ElementMesh): SolidRef => {
  const { positions: _p, indices: _i, ...ref } = m;
  return ref;
};

export type CameraPreset = 'orbit' | 'top' | 'front' | 'back' | 'left' | 'right' | 'bottom';

export const CAMERA_PRESETS: readonly CameraPreset[] = [
  'orbit',
  'top',
  'front',
  'back',
  'left',
  'right',
  'bottom',
];

/** What was clicked: an element (its kind, typed ID and Level), or nothing. */
export type Picked = SolidRef;

const DIRECTIONS: Record<
  CameraPreset,
  { dir: [number, number, number]; up: [number, number, number] }
> = {
  orbit: { dir: [1, 0.9, 1.3], up: [0, 1, 0] },
  top: { dir: [0, 1, 0], up: [0, 0, -1] },
  bottom: { dir: [0, -1, 0], up: [0, 0, 1] },
  front: { dir: [0, 0, 1], up: [0, 1, 0] },
  back: { dir: [0, 0, -1], up: [0, 1, 0] },
  left: { dir: [-1, 0, 0], up: [0, 1, 0] },
  right: { dir: [1, 0, 0], up: [0, 1, 0] },
};

const COLORS: Record<Exclude<SolidRef['kind'], 'openingPart'>, number> = {
  wall: 0xe4e1da,
  slab: 0xa9adb5,
  floorBuildUp: 0xd9c7a7,
};
/** Opening parts (ticket 19): a white frame, wooden leaves, light glass, grey panels. */
const PART_COLORS: Record<OpeningPartKind, number> = {
  frame: 0xf7f7f5,
  leaf: 0xb98a5a,
  glass: 0x9fc9e8,
  panel: 0x8f959e,
};

/** An element's own colour. */
const colorOf = (ref: SolidRef): number =>
  ref.kind === 'openingPart' ? PART_COLORS[ref.part] : COLORS[ref.kind];
const SELECTED = 0x5b8ef0;

export class View3D {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, -1000, 1000);
  private readonly controls: OrbitControls;
  private readonly root = new Group();
  private readonly levels = new Map<LevelId, Group>();
  private readonly hidden = new Set<LevelId>();
  private selected: ReadonlySet<SolidRef['id']> = new Set();
  private readonly resize: ResizeObserver;
  private readonly edgeMaterial = new LineBasicMaterial({ color: 0x3a4250 });
  private frame = 0;
  private fitted = false;
  private preset: CameraPreset = 'orbit';
  private down: { x: number; y: number } | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly onPick: (picked: Picked | null) => void,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.domElement.style.display = 'block';
    this.container.appendChild(this.renderer.domElement);
    this.scene.background = new Color(0xf4f3ef);
    this.scene.add(this.root);
    this.scene.add(new HemisphereLight(0xffffff, 0xb9b4a8, 1.6));
    this.scene.add(new AmbientLight(0xffffff, 0.35));
    const sun = new DirectionalLight(0xffffff, 1.4);
    sun.position.set(0.6, 1, 0.35);
    this.scene.add(sun);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.addEventListener('change', () => this.invalidate());

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => (this.down = { x: e.clientX, y: e.clientY }));
    canvas.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) this.pick(e);
    });

    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(this.container);
    this.measure();
  }

  /** Replaces what is shown; the camera stays where it is (fitted on the first meshes). */
  setMeshes(meshes: readonly ElementMesh[]): void {
    for (const group of this.levels.values()) {
      group.traverse((o) => {
        if (o instanceof Mesh || o instanceof LineSegments) {
          o.geometry.dispose();
          if (o instanceof Mesh) (o.material as MeshStandardMaterial).dispose();
        }
      });
      this.root.remove(group);
    }
    this.levels.clear();
    for (const m of meshes) {
      let group = this.levels.get(m.level);
      if (!group) {
        group = new Group();
        group.visible = !this.hidden.has(m.level);
        this.levels.set(m.level, group);
        this.root.add(group);
      }
      const positions = new Float32Array(m.positions.length);
      for (let i = 0; i < m.positions.length; i += 3) {
        positions[i] = m.positions[i]! / 1000;
        positions[i + 1] = m.positions[i + 2]! / 1000;
        positions[i + 2] = m.positions[i + 1]! / 1000;
      }
      // Swapping y and z mirrors the solid: flip each triangle to keep it facing outward.
      const indices = new Uint32Array(m.indices.length);
      for (let i = 0; i < m.indices.length; i += 3) {
        indices[i] = m.indices[i]!;
        indices[i + 1] = m.indices[i + 2]!;
        indices[i + 2] = m.indices[i + 1]!;
      }
      const glass = m.kind === 'openingPart' && m.part === 'glass';
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(positions, 3));
      geometry.setIndex(new BufferAttribute(indices, 1));
      geometry.computeVertexNormals();
      const mesh = new Mesh(
        geometry,
        new MeshStandardMaterial({
          color: this.selected.has(m.id) ? SELECTED : colorOf(m),
          // Glass lets the Room show through.
          transparent: glass,
          opacity: glass ? 0.45 : 1,
          depthWrite: !glass,
          roughness: 0.9,
          metalness: 0,
          flatShading: true,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        }),
      );
      const picked: Picked = solidRefOf(m);
      mesh.userData = picked;
      group.add(mesh);
      group.add(new LineSegments(new EdgesGeometry(geometry, 25), this.edgeMaterial));
    }
    if (!this.fitted && meshes.length) {
      this.fitted = true;
      this.setPreset(this.preset);
    }
    this.invalidate();
  }

  /** Levels to hide (their IDs). */
  setHiddenLevels(hidden: ReadonlySet<LevelId>): void {
    this.hidden.clear();
    for (const id of hidden) this.hidden.add(id);
    for (const [id, group] of this.levels) group.visible = !hidden.has(id);
    this.invalidate();
  }

  /** Highlights the selected elements (Walls, and a Room's Floor build-up). */
  setSelection(ids: ReadonlySet<SolidRef['id']>): void {
    this.selected = new Set(ids);
    this.root.traverse((o) => {
      if (o instanceof Mesh) {
        const data = o.userData as Picked;
        (o.material as MeshStandardMaterial).color.setHex(
          ids.has(data.id) ? SELECTED : colorOf(data),
        );
      }
    });
    this.invalidate();
  }

  /** One of the six orthographic views, or the orbit view; fits everything visible. */
  setPreset(preset: CameraPreset): void {
    this.preset = preset;
    const box = new Box3();
    for (const group of this.levels.values()) if (group.visible) box.expandByObject(group);
    if (box.isEmpty()) box.set(new Vector3(-5, 0, -5), new Vector3(5, 3, 5));
    const center = box.getCenter(new Vector3());
    const radius = Math.max(box.getSize(new Vector3()).length() / 2, 1);
    const { dir, up } = DIRECTIONS[preset];
    const d = new Vector3(...dir).normalize();
    this.camera.up.set(...up);
    this.camera.position.copy(center).addScaledVector(d, radius * 4);
    this.camera.near = 0.01;
    this.camera.far = radius * 10;
    this.camera.zoom = 1;
    this.frameRadius = radius * 1.1;
    this.controls.target.copy(center);
    this.applyFrustum();
    this.controls.update();
    this.invalidate();
  }

  get currentPreset(): CameraPreset {
    return this.preset;
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.controls.dispose();
    this.setMeshes([]);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private frameRadius = 10;

  private applyFrustum(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const aspect = w / h;
    const r = this.frameRadius;
    this.camera.left = aspect >= 1 ? -r * aspect : -r;
    this.camera.right = aspect >= 1 ? r * aspect : r;
    this.camera.top = aspect >= 1 ? r : r / aspect;
    this.camera.bottom = aspect >= 1 ? -r : -r / aspect;
    this.camera.updateProjectionMatrix();
  }

  private measure(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.applyFrustum();
    this.invalidate();
  }

  private pick(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new Raycaster();
    ray.setFromCamera(pointer, this.camera);
    const targets: Mesh[] = [];
    for (const group of this.levels.values())
      if (group.visible) group.traverse((o) => o instanceof Mesh && targets.push(o));
    const hit = ray.intersectObjects(targets, false)[0];
    this.onPick(hit ? (hit.object.userData as Picked) : null);
  }

  private invalidate(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.renderer.render(this.scene, this.camera);
    });
  }
}

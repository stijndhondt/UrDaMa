/**
 * The 3D view's Web Worker: manifold-3d meshing, off the main thread (ADR 0005). The app's
 * bundler packs this module (and manifold-3d) as a separate worker file.
 */
import { serveManifold } from '@urdama/render3d/worker';

serveManifold();

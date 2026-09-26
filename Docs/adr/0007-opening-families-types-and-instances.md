# Openings are placed instances of a type within a parametric family

An Opening (door, window, wall opening, garage door) is modelled in three levels. An **Opening family** is one parametric object built from parts: frame, leaves, glass, panels. An **Opening type** is a named set of sizes within a family, such as "90 × 211". An **Opening** is a placed instance of a type in a Wall. Changes flow down: editing a family changes all its types and every placed Opening; editing a type changes the Openings of that type; changing one Opening "only for this one" detaches it into a new type. A placed Opening owns only what differs per placement: its host Wall, its position along the Baseline, its hinge side and swing, and its sill height. We chose this so a design is made once and reused in many sizes, and so every view of an Opening (plan symbol, Elevation, 3D, and the six views of the family editor) is derived from the same object and can never disagree.

## Considered Options

- **A flat list of doors and windows**, each with its own sizes. This is the Slice 1 model. It is simple, but every door repeats its design, and a change such as "all interior doors get a glass panel" means editing each one.
- **Blocks with views drawn separately** (Rayon's parametric blocks). Each view is its own drawing inside a block, so a plan symbol and a side view can drift out of alignment. That is the problem this decision exists to avoid.
- **Two levels** (a type holds both design and sizes; a size variant is a duplicated type). Fewer concepts, but a design copied for each size must be re-edited in every copy.
- **Free-form modelling** (sketch and extrude, as in Fusion 360 or Blender). It is maximally flexible, but the shapes carry no meaning for quantities (glass area, frame length) and would be a product of its own. It is not planned.

## Consequences

- The project file gains `openingFamilies` and `openingTypes` collections next to `openings`, and each Opening refers to its type by ID. The schema version goes up, and a migration turns every Slice 1 door and window into an Opening of a built-in default family and type.
- Families and types live in a personal library in the browser. A project file keeps its own copy of every family and type it uses, so it stays self-contained (ADR 0004).
- Quantities can read parts directly, for example glass area per window, because every Opening is made of meaningful parts rather than free geometry.

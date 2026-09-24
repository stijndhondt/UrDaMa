# LAKUDEMIS — Project Initialization

You are the lead software architect and founding engineer for **LAKUDEMIS**, an open-source platform for designing, modeling, calculating, and understanding complete homes and buildings.

## Vision

LAKUDEMIS is not primarily a CAD application.

It is a **connected building model**.

The goal is to create one coherent digital representation of a home or apartment in which the different parts of the building understand their relationships to one another.

A user should eventually be able to:

* draw or modify walls, rooms, floors, roofs, doors, and windows
* design the building in 2D and 3D
* define structural elements
* define insulation
* define flooring, ceilings, finishes, and roofing
* define electrical systems
* define water and plumbing
* define heating and cooling
* define ventilation
* define solar panels and energy systems
* define materials and assemblies
* calculate areas, lengths, volumes, weights, and quantities
* calculate required materials such as paint, insulation, flooring, concrete, etc.
* understand how a change to one part of the building affects other parts
* eventually calculate energy, cost, material, and system consequences

The fundamental principle is:

> **Every part. One model.**

A wall is not merely geometry.

A wall can have:

* geometry
* construction layers
* insulation
* surface finishes
* openings
* structural properties
* thermal properties
* electrical relationships
* material quantities
* cost
* connections to rooms
* connections to floors and roofs

Similarly, a room is not merely an enclosed polygon.

It can contain:

* surfaces
* floor and ceiling assemblies
* doors
* windows
* electrical points
* heating
* ventilation
* furniture
* calculated areas and volumes
* material requirements

The system should therefore be designed around a **semantic building model**, not around drawing primitives.

---

# Core Architectural Principle

Separate the application into clear layers:

1. **Domain model**

   * Building
   * Site
   * Levels
   * Spaces / Rooms
   * Walls
   * Slabs
   * Roofs
   * Openings
   * Doors
   * Windows
   * Assemblies
   * Materials
   * Building systems
   * Connections
   * Measurements
   * Quantities

2. **Geometry engine**

   * 2D geometry
   * 3D geometry
   * intersections
   * offsets
   * extrusion
   * boolean operations
   * surfaces
   * volumes
   * topology

3. **Dependency / relationship engine**

   * determine what depends on what
   * propagate changes
   * invalidate affected calculations
   * recalculate derived values

4. **Calculation engine**

   * areas
   * lengths
   * volumes
   * quantities
   * material takeoffs
   * basic cost calculations
   * eventually thermal, energy, structural and system calculations

5. **Persistence**

   * projects
   * versions
   * undo/redo
   * serialization
   * migrations
   * deterministic project files

6. **Application/UI**

   * 2D editor
   * 3D viewer
   * property panels
   * project tree
   * material/system editors
   * quantity reports

7. **Import/export**

   * eventually IFC
   * DXF
   * OBJ/GLTF
   * CSV
   * PDF reports
   * other relevant formats

Do not allow UI code to become the source of truth for the building model.

The domain model must be usable independently of the UI.

---

# First Goal

Do NOT attempt to build the complete application immediately.

Build a strong foundation that can grow into the complete system.

The first milestone should be a small but architecturally correct vertical slice:

### Example

Create a project containing:

* one building
* one level
* several walls
* one or more rooms
* doors/windows
* floor geometry

The application should be able to:

1. create the building model
2. render it in 2D
3. render it in 3D
4. select an element
5. edit its properties
6. derive room geometry from walls
7. calculate room area
8. calculate wall lengths/areas
9. calculate basic material quantities
10. save and reload the project

The important part is that these calculations should come from the **same underlying model** used by the 2D and 3D views.

---

# Technology

Before writing substantial code:

1. Inspect the repository.
2. Determine the existing language/toolchain.
3. If the repository is empty, propose a modern, well-supported open-source stack appropriate for a cross-platform desktop application with a serious geometry engine.
4. Prefer technologies with strong support for:

   * TypeScript or strongly typed languages
   * 2D/3D rendering
   * computational geometry
   * testing
   * serialization
   * desktop packaging
   * open-source licensing

Do not introduce unnecessary dependencies.

Before choosing a major geometry library, compare the available options and document the decision.

---

# Domain Model

Start designing a versioned domain model.

The model should eventually resemble:

```text
Project
 └── Building
      ├── Site
      ├── Levels
      │    ├── Spaces
      │    ├── Walls
      │    ├── Slabs
      │    └── Openings
      │         ├── Doors
      │         └── Windows
      │
      ├── Assemblies
      │    ├── Wall assemblies
      │    ├── Floor assemblies
      │    ├── Roof assemblies
      │    └── Ceiling assemblies
      │
      ├── Materials
      │
      └── Building Systems
           ├── Electrical
           ├── Plumbing
           ├── Heating
           ├── Cooling
           ├── Ventilation
           └── Solar
```

Do not blindly implement this exact structure.

Analyze it and improve it where necessary.

The important requirement is that relationships are explicit.

For example:

```text
Wall
 ├── belongsTo Level
 ├── bounds Spaces
 ├── contains Openings
 ├── uses Assembly
 ├── consists of Materials
 └── produces Quantities
```

---

# IDs and References

Every persistent domain entity should have a stable unique ID.

Do not use array indexes as identity.

References between entities should use IDs or an equivalent stable mechanism.

The project format must remain deterministic and versionable.

---

# Derived Data

Clearly distinguish:

### Source data

Information explicitly supplied by the user.

Example:

```text
wall thickness = 250 mm
wall height = 2.8 m
assembly = exterior_wall_01
```

### Derived data

Information calculated by the system.

Example:

```text
wall surface area
room area
room volume
paint quantity
insulation quantity
```

Derived data should not become the authoritative source of truth.

It should be reproducible from the model.

---

# Units

Internally use a consistent unit system.

Do not store arbitrary strings such as:

```text
"2.5m"
"250mm"
"10ft"
```

as the fundamental numerical representation.

Use typed quantities or a well-defined internal unit convention.

The UI may display:

* mm
* cm
* m
* m²
* m³
* litres
* kg
* kWh
* etc.

Users should eventually be able to configure display units.

---

# Geometry

Geometry must be treated as a first-class subsystem.

Avoid building a fake 3D system where objects are merely independent boxes.

The geometry system eventually needs to understand:

* connected walls
* wall intersections
* openings
* room boundaries
* floors
* ceilings
* roofs
* offsets
* thickness
* topology

Start simple, but make the architecture capable of becoming sophisticated.

---

# Dependency Graph

This is one of the most important parts of LAKUDEMIS.

Design a mechanism for dependencies.

For example:

```text
Wall
 ↓
Room boundary
 ↓
Room area
 ↓
Floor quantity
 ↓
Floor material quantity
 ↓
Cost
```

Another example:

```text
Window
 ↓
Wall opening
 ↓
Wall surface area
 ↓
Paint quantity
```

Eventually:

```text
Window area
 ↓
Thermal properties
 ↓
Heat-loss calculation
 ↓
Heating requirement
 ↓
Heating system sizing
 ↓
Energy consumption
```

A change should invalidate and recalculate only what is actually affected.

Do not implement this as a giant collection of UI callbacks.

Build a proper domain-level dependency mechanism.

---

# Undo / Redo

Design undo/redo from the beginning.

Prefer domain-level commands/transactions rather than UI-specific hacks.

Example:

```text
AddWall
MoveWall
ResizeWall
ChangeWallAssembly
AddWindow
MoveWindow
DeleteDoor
```

The system should eventually support:

* undo
* redo
* grouped operations
* transactions

---

# Testing

Testing is a first-class requirement.

Create tests for:

* domain entities
* geometry
* serialization
* calculations
* dependency propagation
* commands
* undo/redo

Use deterministic fixtures.

For geometry, include numerical tolerances where appropriate.

Do not make tests dependent on screenshots or UI state unless absolutely necessary.

---

# Project File Format

Design a human-readable project format if practical.

It should:

* have a schema version
* have stable IDs
* be deterministic
* be migration-friendly
* allow future expansion
* avoid storing unnecessary derived data

A project should ideally be portable and usable without the UI.

---

# Open Source

Assume LAKUDEMIS will be open source from day one.

Keep licensing and dependency compatibility in mind.

Do not introduce proprietary dependencies unless there is a compelling reason.

Create appropriate foundational documentation:

```text
README
ARCHITECTURE
CONTRIBUTING
LICENSE
docs/
```

Document important architectural decisions.

---

# Development Philosophy

Prefer:

* small composable modules
* explicit domain concepts
* strong typing
* deterministic calculations
* pure functions where appropriate
* testable logic
* clear interfaces
* minimal coupling
* boring reliable infrastructure

Avoid:

* premature abstractions
* massive god classes
* UI-driven domain logic
* duplicated state
* magic numbers
* hidden global state
* unnecessary frameworks
* implementing every future feature immediately

---

# Important Product Principle

Never let LAKUDEMIS become:

> "a 3D drawing application with some calculators attached."

The core idea is:

> **LAKUDEMIS is a semantic model of a building.**

The 2D editor, 3D renderer, quantity calculator, material system, electrical system, heating system, and reports are different views and consumers of that model.

The model comes first.

---

# First Task

Before implementing the application:

1. Inspect the repository.
2. Produce a concise assessment of its current state.
3. Propose the initial architecture.
4. Identify the major technology decisions.
5. Define the initial domain model.
6. Define the initial project file/schema.
7. Define the first vertical slice.
8. Identify risks, especially around computational geometry.
9. Then implement the smallest useful foundation.

Do not generate thousands of lines of speculative code.

Build incrementally.

After each major step:

* run tests
* run type checking
* run linting/formatting if applicable
* verify the application builds
* explain what was implemented
* explain the next logical step

When making architectural decisions, optimize for the ability of LAKUDEMIS to grow from a simple house planner into a complete building information and calculation platform.

The long-term objective is:

> **One building. One connected model. Every consequence understood.**

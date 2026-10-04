# Lakudemis

A connected, semantic model of a home: every part of the building is one entity in one model, and 2D plans, 3D views and calculations are views and consumers of that model.

## Language

### Building structure

**Level**:
A storey of the building, such as basement, ground floor, first floor or attic. Its elevation is its finished floor level.
_Avoid_: Floor, storey, verdieping

**Slab**:
The structural horizontal element that separates or carries Levels.
_Avoid_: Floor, deck

**Ceiling**:
The finished underside that closes a Room at its Room height (plaster, plasterboard, suspended ceiling). It is a separate element from the Slab above it.
_Avoid_: Plafond, Slab (for the finished underside)

**Ceiling void**:
The space between the top of a Room's Ceiling and the underside of the Slab above; it carries cables, ducts and beams.
_Avoid_: Plenum, cavity, spouwe

**Floor build-up**:
Everything between the top of the Slab and the finished floor of a Room, such as insulation, screed and the Floor finish.
_Avoid_: Floor, floor package, dekvloer (for the whole)

**Floor finish**:
The top layer of a Floor build-up, the surface walked on, such as tiles, laminate or parquet.
_Avoid_: Floor, flooring (as a noun for the element)

**Wall**:
A vertical building element with a length, a thickness and a Wall height, standing on a Level. It either bounds Rooms or is free-standing (such as a half-height wall or a kitchen island) and bounds nothing.
_Avoid_: Partition (as a separate kind)

**Baseline**:
The line a Wall is drawn along, from its start point to its end point. The Wall's thickness sits to the left of it, centred on it or to the right of it.
_Avoid_: Axis, centreline (unless the Wall is centred), location line

**Wall connection**:
A stored attachment of one Wall's end to another Wall: either to its end (a corner) or to its face at a given distance (a T). Connected Walls move together; unconnected Walls never join, however close they are. A T stays where it is in the plan: when a move leaves its host no longer reaching it, it is carried by the Wall that now does (the same connection, another host). When no Wall does, it stays on its host while it still meets the host's end (within the host's thickness, as a T at a Wall's end always could); beyond that the move is refused.
_Avoid_: Snap, join (for the stored relationship; "join" is the computed geometry)

**Opening**:
A hole in a Wall, placed as an instance of an Opening type: a door, a window, a wall opening or a garage door. It is positioned along the Wall's Baseline, has its own sill height and opening direction, and takes its other sizes from its type. It cannot exist without its host Wall.
_Avoid_: Hole, cut-out, aperture, block

**Opening family**:
A design of an Opening, made once as one object from parametric parts (frame, leaves, glass, panels) and seen in every view, such as "interior door, single leaf". A change to the family changes all its Opening types and every Opening of them.
_Avoid_: Block, template, object (unqualified)

**Opening type**:
A named set of sizes within an Opening family, such as "90 × 211" of the interior door family. Each Opening is an instance of one Opening type and follows it: a change to the type changes every Opening of that type. Changing one Opening on its own detaches it into a new Opening type of its own.
_Avoid_: Block, variant, template

**Wall face**:
One side of a Wall: the surface that is painted, plastered or tiled. It faces a Room or the outside.
_Avoid_: Wall side, surface (unqualified)

**Wall run**:
Two or more Walls whose faces continue one another in a straight line, such as the whole left side of a house made of the left Walls of the Rooms one behind the other. Its overall length is measured along its outside.
_Avoid_: Wall chain, wall line, total wall

**Façade**:
All outside Wall faces of the building on one side (front, back, left side or right side, as seen standing in front of the house), counted relative to the building's own front, not to compass directions. A Façade that is not flat, such as the front of an L- or T-shaped house, splits into Façade parts that each lie in one plane.
_Avoid_: Exterior wall (for the surface), gevel (in code; the Dutch UI says Gevel), elevation (for the surface)

**Wall height**:
The height of a Wall itself. Usually greater than the Room height of the Rooms it bounds; a partial-height wall (divider, bar wall) has its own, lower Wall height.
_Avoid_: Height (unqualified)

**Room height**:
The height of a Room measured from floor to ceiling, as a tape measure gives it. It can differ per Room on the same Level.
_Avoid_: Clear height, ceiling height, Height (unqualified)

**Preset**:
A default value set per project, such as wall thickness or slab thickness, that new elements take unless the value is overridden on the element.
_Avoid_: Template, default settings, style

**Room**:
An enclosed area of a Level, derived from the Walls and Room separators around it and adjustable by hand.
_Avoid_: Space, zone, area (as the element)

**Seed point**:
A point inside a Room that identifies which enclosed area the Room is. The Room's outline is derived from the Walls and Room separators around it.
_Avoid_: Room marker, tag

**Room separator**:
A line with no physical form that divides an open area into separate Rooms, such as between a kitchen and a living area.
_Avoid_: Virtual wall, room boundary line

### Model

**Source data**:
What the user states about the building, such as a Wall's Baseline, a thickness override or a Room height. It is the only thing a project file stores.
_Avoid_: Input, parameters, properties (for the category)

**Derived value**:
Anything calculated from Source data, such as a Room outline, an area or a warning. It is never stored, always reproducible, and carries a readable name such as "Keuken · Net floor area".
_Avoid_: Computed property, cached value, result

### Views

**Elevation**:
A flat, straight-on drawing of the building seen from one side (front, back, left or right), all Levels stacked, showing what is visible from outside: Wall faces, Openings, Slab edges and heights.
_Avoid_: Side view, façade view, gevelaanzicht (in code; the Dutch UI says Gevelaanzicht)

**Section plane**:
A plane that slices the building in a view: everything between the viewer and the plane is cut away, so the inside shows.
_Avoid_: Slicer, cut, clipping plane

### Measurements

**Net area**:
An area measured to the inner faces of the bounding elements, with openings subtracted where they apply.
_Avoid_: Usable area, inner area

**Gross area**:
An area measured to the outer faces of the bounding elements, as used for building-envelope and energy (EPB) calculations.
_Avoid_: Outer area, total area

**Measurement rule**:
A named rule for how a quantity is measured, such as which openings are subtracted from a wall area and above what size. It is chosen per report, never stored on elements.
_Avoid_: Measurement preset, Preset

### Contents

**Furnishing**:
A parametric object placed in a Room (table, seat, desk lamp, wall cabinets) that occupies space but has no connection to a building system and does not change Room areas.
_Avoid_: Furniture block, object, item

**Fixture**:
An object fixed to the building and connected to a building system (wall light, sink, radiator, socket).
_Avoid_: Furnishing, appliance

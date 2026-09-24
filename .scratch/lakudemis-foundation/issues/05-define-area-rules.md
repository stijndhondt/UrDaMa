# Define Net and Gross area rules

Type: research
Status: resolved
Blocked by:
Parent: [Lakudemis foundation & Slice 1](../map.md)

## Question

How are floor and wall areas defined in practice, so that Lakudemis can derive named area types? Cover:

- Belgian EPB rules: heat-loss surfaces, outer dimensions, protected volume
- NBN/ISO 9836 area definitions: net and gross floor area
- how openings are subtracted from wall areas, including any size threshold below which small openings are ignored for paint and plaster quantities
- how areas under low or sloped ceilings are treated (for later attic work)

Output: a table of named area types, each with its measurement boundary and whether Slice 1 needs it.

Research: branch `research/area-rules`, file `Docs/research/area-rules.md`.

## Answer

- **Our Net/Gross definitions hold.**
  - All three Belgian regions measure EPB heat-loss surfaces and protected volume on **outer dimensions**. Walls shared with a neighbouring home count at half thickness, and exact edges are defined at junctions.
  - Room floor areas for ventilation use **inner dimensions**.
- **Gross area has more than one variant.**
  - The EPB gross floor area runs through internal walls, excludes voids over 4 m², and excludes floor below 1.50 m clear height (Brussels also requires 2.10 m under a flat ceiling; Wallonia requires the space to reach 2.20 m somewhere).
  - A plain outer-face footprint gives a different number, so the calculator needs **several named Gross area types**, not one.
- **Openings:** there is no universal subtraction threshold.
  - Belgian federal specification (Regie der Gebouwen): paint and plaster are net with no threshold; masonry ignores openings under 0.25 m²; plasterboard ignores openings under 0.50 m².
  - German VOB: openings up to 2.5 m² are not subtracted for paint and plaster.
  - → Store exact opening geometry, and make each threshold a **named measurement preset** applied by the calculator.
- **Low and sloped ceilings:** all conventions cut at 1.0, 1.5, 2.0, 2.1 and 2.2 m. Rooms will need clear height. This is deferred to the attic work, but outer-face geometry is kept now so it can be added without rework.
- **Slice 1 needs** (from the note's table of 17 named area types):
  - room net floor area
  - floor finish area
  - Level gross area
  - wall face areas (gross, net, and net per preset)
  - reveals
  - opening areas
  - wall axis length
  - Slab area
- **Deferred:** heat-loss surfaces, protected volume and height-banded areas, which all need roofs.
- **Caveats:** the Wallonia wording comes from a search-index extract. ISO 9836, NEN 2580, DIN 277 and VOB are paywalled and summarised from secondary sources. "EPB wall area = outer wall minus openings" is inferred, not quoted.

Findings: branch `research/area-rules` (commit 25df561), `Docs/research/area-rules.md`.

# Dependency and recalculation engine

Type: grilling
Status: open
Blocked by: 07
Parent: [Lakudemis foundation & Slice 1](../map.md)

## Question

How does Lakudemis track what depends on what (Wall → Room outline → Room area → Floor finish quantity), and recalculate only what a change affects?

Options include:

- a reactive signal graph
- an explicit dependency graph with invalidation
- recomputing everything after each change

Weigh them on running outside the UI, determinism and testability.

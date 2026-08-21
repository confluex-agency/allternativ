import { notFound } from "next/navigation";

// Prototype routes that must not exist on the public site.
//
// Five pages were built to try things out and never linked from anywhere:
// the 3D viewer harness, a lens inspector, a colourway proof of concept, and
// two scroll prototypes. Not being linked is not the same as not existing. They
// build, they deploy, and anyone who types the path reaches them.
//
// One of them, /demo, renders "Classic Aviator" at "$249.00" as scaffolding for
// the 3D viewer. Under a real brand on a real domain that is a product nobody
// sells at a price nobody set, and the fact that a caption underneath admits it
// is a placeholder does not undo the heading above it.
//
// Deleting them would throw away work that is still worth having: the 3D
// direction is unresolved and these are how it gets looked at. So they stay in
// the repository and stop existing in production.
export function devOnlyRoute(): void {
  if (process.env.NODE_ENV === "production") notFound();
}

"use client";

import dynamic from "next/dynamic";

const OrbitalColorDemo = dynamic(
  () =>
    import("@/components/storefront/orbital-color-demo").then(
      (mod) => mod.OrbitalColorDemo
    ),
  { ssr: false }
);

export function OrbitalColorDemoLazy() {
  return <OrbitalColorDemo />;
}

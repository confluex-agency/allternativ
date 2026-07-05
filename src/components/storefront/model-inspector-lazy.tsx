"use client";

import dynamic from "next/dynamic";

const ModelInspector = dynamic(
  () =>
    import("@/components/storefront/model-inspector").then(
      (mod) => mod.ModelInspector
    ),
  { ssr: false }
);

export function ModelInspectorLazy({
  src,
  className = "",
}: {
  src: string;
  className?: string;
}) {
  return <ModelInspector src={src} className={className} />;
}

"use client";

import dynamic from "next/dynamic";

const GlassesViewer = dynamic(
  () =>
    import("@/components/storefront/glasses-viewer").then(
      (mod) => mod.GlassesViewer
    ),
  { ssr: false }
);

export function GlassesViewerLazy({ className = "" }: { className?: string }) {
  return <GlassesViewer className={className} />;
}

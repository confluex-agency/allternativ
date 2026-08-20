import dynamic from "next/dynamic";
import { StorefrontNavbar } from "@/components/storefront/navbar";
import { StorefrontFooter } from "@/components/storefront/footer";
import { TrackerInit } from "@/components/storefront/tracker-init";

// The image-framing sliders, development only.
//
// ⚠️ The import has to live INSIDE the branch, and it has to be a dynamic one.
// A plain `import` at the top of the file plus `{isDev && <Tool />}` does not
// work: the tool is a `"use client"` module, so merely naming it makes it a
// client entry point, and it was still landing in the production bundle as a
// 21KB chunk referenced by every storefront page. Verified by building and
// grepping `.next` for a string only this component contains.
//
// `process.env.NODE_ENV` is inlined at build time, so in production this whole
// branch folds away and the `import()` is never emitted.
const ImageFramingTool =
  process.env.NODE_ENV === "development"
    ? dynamic(() =>
        import("@/components/dev/image-framing-tool").then((m) => ({
          default: m.ImageFramingTool,
        })),
      )
    : null;

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <StorefrontNavbar />
      <main className="flex-1">{children}</main>
      <StorefrontFooter />
      <TrackerInit />
      {ImageFramingTool && <ImageFramingTool />}
    </>
  );
}

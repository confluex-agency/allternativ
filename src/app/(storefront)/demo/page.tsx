import { GlassesViewerLazy } from "@/components/storefront/glasses-viewer-lazy";

export const metadata = {
  title: "3D Viewer Demo",
};

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        {/* 3D Viewer */}
        <div className="space-y-4">
          <GlassesViewerLazy className="aspect-square" />
        </div>

        {/* Mock product info */}
        <div>
          <h1 className="text-3xl font-light tracking-tight">
            Classic Aviator
          </h1>
          <p className="mt-4 text-2xl">$249.00</p>

          <p className="mt-6 text-neutral-600 leading-relaxed">
            Handcrafted titanium frame with polarized lenses. Lightweight,
            durable, and designed to stand out.
          </p>

          <dl className="mt-8 space-y-3 text-sm">
            <div className="flex gap-3">
              <dt className="text-neutral-500 w-28">Type</dt>
              <dd>SUNGLASSES</dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-neutral-500 w-28">Frame Shape</dt>
              <dd>AVIATOR</dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-neutral-500 w-28">Material</dt>
              <dd>Titanium</dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-neutral-500 w-28">Color</dt>
              <dd>Matte Black</dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-neutral-500 w-28">Lens</dt>
              <dd>Polarized</dd>
            </div>
          </dl>

          <div className="mt-10">
            <button className="w-full bg-neutral-950 text-white py-3 text-sm font-medium tracking-wide hover:bg-neutral-800 transition-colors">
              ADD TO CART
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

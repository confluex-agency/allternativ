import { ModelInspectorLazy } from "@/components/storefront/model-inspector-lazy";
import { devOnlyRoute } from "@/lib/dev-only";

export const metadata = {
  title: "Lens 3D — test",
};

// Throwaway page to eyeball freshly generated 3D lenses before wiring them
// into the real product pages. Not linked from the nav.
export default function LensTestPage() {
  devOnlyRoute();

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 md:px-6 md:py-16">
      <p className="eyebrow text-brand-muted mb-3">test · lentes 1</p>
      <h1 className="display text-[clamp(2rem,6vw,3.5rem)] text-brand-ink">
        Modelo 3D generado
      </h1>
      <p className="mt-4 max-w-xl text-brand-ink-soft">
        Primera prueba con Higgsfield (multi-image → 3D, 4 vistas). Gíralo,
        revisa la forma, el material y cómo quedó el logo.
      </p>

      <ModelInspectorLazy
        src="/models/lens-01-test.glb"
        className="mt-8 aspect-[4/3] md:aspect-video"
      />
    </div>
  );
}

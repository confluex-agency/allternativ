import { OrbitalColorDemoLazy } from "@/components/storefront/orbital-color-demo-lazy";
import { OrbitalSpin } from "@/components/storefront/orbital-spin";
import { devOnlyRoute } from "@/lib/dev-only";

export const metadata = {
  title: "Orbital — color test",
};

// Throwaway page: proof of concept for the colourway selector driving both the
// 3D model and the product photo at once. Not linked from the nav.
export default function OrbitalTestPage() {
  devOnlyRoute();

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 md:px-6 md:py-16">
      <p className="eyebrow text-brand-muted mb-3">test · orbital</p>
      <h1 className="display text-[clamp(2rem,6vw,3.5rem)] text-brand-ink">
        Cambio de color
      </h1>
      <p className="mt-4 max-w-xl text-brand-ink-soft">
        Elige el color abajo: el modelo 3D y la foto real cambian juntos. Negro
        usa la textura horneada; plata aplica un material metálico sobre la misma
        malla (estilo The Corinthian).
      </p>

      <div className="mt-8">
        <OrbitalColorDemoLazy />
      </div>

      {/* Divider */}
      <hr className="my-14 border-brand-ink/10 md:my-20" />

      <p className="eyebrow text-brand-muted mb-3">alternativa · giro de fotos</p>
      <h2 className="display text-[clamp(1.75rem,5vw,3rem)] text-brand-ink">
        Giro 360° con fotos reales
      </h2>
      <p className="mt-4 max-w-xl text-brand-ink-soft">
        Sin 3D: arrastra para pasar por las vistas reales del lente. Calidad de
        foto pura, cero manchas. El color cambia el set de fotos.
      </p>

      <div className="mt-8 max-w-2xl">
        <OrbitalSpin />
      </div>
    </div>
  );
}

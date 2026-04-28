import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const metadata = {
  title: "About",
  description:
    "Allternativ nace en la intersección entre techno, sunsets y lo sensorial. Lentes para una realidad alterada.",
};

const PILLARS = [
  {
    title: "Textura",
    body: "Cada frame está acabado con tramas tornasol propias de la casa. El color cambia con la luz — igual que un sunset no es nunca el mismo dos veces.",
    tint: "bg-brand-rose",
  },
  {
    title: "Sonido",
    body: "Nuestras piezas se diseñan escuchando. Techno lento, chillout, ambient — frecuencias largas que informan las curvas del marco.",
    tint: "bg-brand-mint",
  },
  {
    title: "Cotidiano",
    body: "No buscamos un objeto de pasarela. Buscamos el que vas a tener en tu cabeza cuando salgas a caminar y la tarde empiece a doblarse.",
    tint: "bg-brand-sky",
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      <section className="relative min-h-[60vh] overflow-hidden md:min-h-[70vh]">
        <Image
          src="/brand/holo-trama-2.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-80"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-transparent via-brand-beige/40 to-brand-beige"
        />
        <div className="relative mx-auto flex min-h-[60vh] md:min-h-[70vh] max-w-[1440px] flex-col justify-end px-5 py-14 md:px-6 md:py-24 lg:px-12">
          <p className="eyebrow text-brand-ink-soft mb-5">about us</p>
          <h1 className="display chromatic-title text-[clamp(2.75rem,11vw,7rem)] text-brand-ink">
            Realidades
            <br />
            alteradas.
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-20 md:px-6 md:py-32 lg:px-12 lg:py-48">
        <div className="grid gap-10 md:grid-cols-12 md:gap-12">
          <div className="md:col-span-5">
            <p className="eyebrow text-brand-muted mb-5">manifesto</p>
            <h2 className="display text-[clamp(1.75rem,5vw,3.5rem)] text-brand-ink">
              Lentes
              <br />
              con banda sonora.
            </h2>
          </div>
          <div className="space-y-5 text-base leading-relaxed text-brand-ink-soft md:col-span-7 md:space-y-6 md:text-lg">
            <p>
              Allternativ nace en esa hora rara de la tarde donde todo se
              vuelve un poco líquido. Queríamos un objeto cotidiano — un par
              de lentes — que condensara esa sensación y la llevara puesta.
            </p>
            <p>
              Las tramas tornasol, los degradados suaves, el color cambiando
              con el ángulo: son gestos que conocemos del techno y del
              ambient, donde los elementos se transforman despacio sin
              abandonarte.
            </p>
            <p>
              La marca no propone una estética agresiva. Propone una
              frecuencia. Un lenguaje sensorial que acompaña a quien lo usa
              y se queda, discreto, en la cabeza.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white/60 py-20 md:py-32 lg:py-48">
        <div className="mx-auto max-w-[1440px] px-5 md:px-6 lg:px-12">
          <p className="eyebrow text-brand-muted mb-5">pillars</p>
          <h2 className="display mb-10 text-[clamp(1.75rem,5vw,3.5rem)] text-brand-ink md:mb-16">
            Tres ejes.
          </h2>
          <div className="grid gap-4 md:grid-cols-3 md:gap-6">
            {PILLARS.map((pillar, idx) => (
              <article
                key={pillar.title}
                className={`relative overflow-hidden rounded-[1.25rem] p-6 md:rounded-[1.5rem] md:p-10 ${pillar.tint}`}
              >
                <p className="eyebrow text-brand-ink/50 mb-10 md:mb-16">
                  0{idx + 1}
                </p>
                <h3 className="display text-2xl md:text-3xl text-brand-ink">
                  {pillar.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-brand-ink-soft md:mt-4">
                  {pillar.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-20 md:px-6 md:py-32 lg:px-12 lg:py-48">
        <div className="grid gap-10 md:grid-cols-12 md:items-center md:gap-16">
          <div className="relative md:col-span-6 aspect-[4/5] overflow-hidden rounded-[1.5rem] md:rounded-[2rem]">
            <Image
              src="/brand/product-prism.png"
              alt="Prisma de referencia — acabado tornasol"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="md:col-span-6">
            <p className="eyebrow text-brand-muted mb-5">craft</p>
            <h2 className="display text-[clamp(1.75rem,5vw,3.5rem)] text-brand-ink">
              Hecho despacio,
              <br />
              pensado aún más.
            </h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-brand-ink-soft md:mt-8">
              Prototipamos cada frame a mano antes de pasarlo a producción.
              Probamos el acabado en distintas luces — natural, dicroica,
              fluorescente — para asegurarnos de que el tornasol funcione
              sin importar dónde estés.
            </p>
            <Link
              href="/products"
              className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-ink px-6 py-3 eyebrow text-brand-beige fluid-transition hover:bg-brand-ink/90 md:mt-10"
            >
              Ver el catálogo
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

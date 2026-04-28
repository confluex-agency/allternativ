import { Instagram, Mail, MapPin } from "lucide-react";

export const metadata = {
  title: "Contact",
  description:
    "Escribinos. Colaboraciones, pedidos especiales, distribución o charla sobre frecuencias.",
};

const CHANNELS = [
  {
    icon: Mail,
    label: "Mail",
    value: "hola@allternativ.com",
    href: "mailto:hola@allternativ.com",
  },
  {
    icon: Instagram,
    label: "Instagram",
    value: "@allternativ",
    href: "#",
  },
  {
    icon: MapPin,
    label: "Taller",
    value: "Buenos Aires — visitas con cita previa",
    href: null,
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-5 py-16 md:px-6 md:py-24 lg:px-12 lg:py-40">
      <div className="grid gap-12 md:grid-cols-12 md:gap-16">
        <div className="md:col-span-5">
          <p className="eyebrow text-brand-muted mb-5">contact</p>
          <h1 className="display text-[clamp(2.5rem,8vw,5rem)] text-brand-ink">
            Escribinos.
          </h1>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-brand-ink-soft md:mt-8">
            Colaboraciones, pedidos especiales, distribución o charlas sobre
            frecuencias y sunsets. Leemos todos los mensajes.
          </p>

          <ul className="mt-10 space-y-5 md:mt-12 md:space-y-6">
            {CHANNELS.map(({ icon: Icon, label, value, href }) => (
              <li key={label} className="flex items-start gap-4">
                <span className="mt-1 grid size-10 shrink-0 place-items-center rounded-full bg-brand-rose">
                  <Icon size={16} className="text-brand-ink" />
                </span>
                <div className="min-w-0">
                  <p className="eyebrow text-brand-muted">{label}</p>
                  {href ? (
                    <a
                      href={href}
                      className="mt-1 block break-words text-base text-brand-ink fluid-transition hover:text-brand-ink-soft"
                    >
                      {value}
                    </a>
                  ) : (
                    <p className="mt-1 break-words text-base text-brand-ink">
                      {value}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <form className="glass md:col-span-7 rounded-[1.5rem] p-6 md:rounded-[2rem] md:p-12">
          <p className="eyebrow text-brand-muted mb-2">formulario</p>
          <h2 className="display mb-8 text-2xl text-brand-ink md:mb-10 md:text-3xl">
            Contanos qué tenés en mente.
          </h2>

          <div className="grid gap-5 md:grid-cols-2 md:gap-6">
            <Field label="Nombre" name="name" required />
            <Field label="Email" name="email" type="email" required />
          </div>
          <div className="mt-5 md:mt-6">
            <label
              className="eyebrow mb-2 block text-brand-muted"
              htmlFor="topic"
            >
              Asunto
            </label>
            <select
              id="topic"
              name="topic"
              className="min-h-11 w-full rounded-xl border border-brand-ink/15 bg-white/70 px-4 py-3 text-base text-brand-ink focus:border-brand-ink focus:outline-none fluid-transition"
              defaultValue="general"
            >
              <option value="general">Consulta general</option>
              <option value="custom">Pedido especial</option>
              <option value="press">Prensa / colaboración</option>
              <option value="stockist">Distribución / stockist</option>
            </select>
          </div>
          <div className="mt-5 md:mt-6">
            <label
              className="eyebrow mb-2 block text-brand-muted"
              htmlFor="message"
            >
              Mensaje
            </label>
            <textarea
              id="message"
              name="message"
              rows={5}
              required
              placeholder="Contanos con libertad."
              className="w-full rounded-xl border border-brand-ink/15 bg-white/70 px-4 py-3 text-base text-brand-ink placeholder:text-brand-muted focus:border-brand-ink focus:outline-none fluid-transition resize-none"
            />
          </div>
          <button
            type="submit"
            className="mt-8 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-ink px-7 py-3 eyebrow text-brand-beige fluid-transition hover:bg-brand-ink/90 md:mt-10 md:w-auto"
          >
            Enviar
          </button>
          <p className="mt-4 text-xs text-brand-muted">
            Mock preview — conectamos a Formspree cuando Diego confirme el endpoint.
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="eyebrow mb-2 block text-brand-muted" htmlFor={name}>
        {label}
        {required && <span className="ml-1 text-brand-rose">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="min-h-11 w-full rounded-xl border border-brand-ink/15 bg-white/70 px-4 py-3 text-base text-brand-ink placeholder:text-brand-muted focus:border-brand-ink focus:outline-none fluid-transition"
      />
    </div>
  );
}

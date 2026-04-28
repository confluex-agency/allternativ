# Allternativ — Design System (MASTER)

Source of truth for the Allternativ storefront. Derived from the designer brand book (2026-04) and UI Pro Max skill (`Liquid Glass` archetype + `Feature-Rich Showcase` landing pattern).

## Brand voice

- Tagline: **escape the ordinary**
- Concept: lentes premium vinculados a un lifestyle alternativo, música electrónica (techno / chill), sunsets, experiencias sensoriales. "Realidad alterada" sin perder lo humano.
- Personality: etérea, sensorial, contemporánea, introspectiva. Not loud, not playful.

## Style archetype: Liquid Glass

- Iridescent, holographic, chromatic aberration
- Morphing shapes, soft gradients, tornasol
- Backdrop blur + saturation for glass surfaces
- Fluid transitions 400–600ms, `cubic-bezier(0.22, 1, 0.36, 1)`

## Color tokens

| Token | Hex | Rol |
|-------|-----|-----|
| `--brand-beige` | `#f7f3f0` | Base / background por defecto |
| `--brand-rose` | `#ffcfff` | Accent iridiscente 1 |
| `--brand-mint` | `#dcffe8` | Accent iridiscente 2 |
| `--brand-sky` | `#96bdff` | Accent iridiscente 3 |
| `--brand-ink` | `#0a0a0a` | Texto principal + CTA primario |
| `--brand-ink-soft` | `#3a3a3a` | Texto secundario |
| `--brand-muted` | `#8a8a8a` | Texto terciario / metadata |

Contrast: `ink` sobre `beige` = 19:1 (WCAG AAA). Colores pasteles NO se usan para texto — solo como fondos, overlays, accents de bordes/rings.

## Typography

- Familia única: **DM Sans** (variable, pesos 300–700)
- Scale: 12 / 14 / 16 / 20 / 28 / 40 / 64 / 96
- Display (h1 hero): 64–96px, peso 300, tracking -0.02em, lowercase
- Body: 16px, peso 400, line-height 1.6
- Labels / nav / eyebrow: 12–14px, peso 500, uppercase, tracking 0.18em

## Effects

- Iridescent gradient: `conic-gradient(from 180deg, #ffcfff, #dcffe8, #96bdff, #ffcfff)` con `filter: blur(40px) saturate(140%)`
- Glass surface: `backdrop-filter: blur(15px) saturate(180%); background: rgba(247,243,240,0.55); border: 1px solid rgba(255,255,255,0.6)`
- Chromatic title: dos text-shadows offset (rose izquierda, sky derecha) + `mix-blend-mode: screen` en hover
- Radii: `sm 4 / md 12 / lg 20 / pill 9999` — bordes redondeados siempre (brand book mandate)
- Shadows: ultra suaves, `0 20px 60px -30px rgba(150,189,255,0.4)` (sky tint)

## Layout

- Max content width: `1440px`, gutters `24px → 64px` por breakpoint
- Breakpoints: 375 / 768 / 1024 / 1440
- Section vertical rhythm: 96 / 144 / 192 px (mobile / tablet / desktop)
- Grid: 12-col desktop, 4-col mobile, gutter 24px

## Component patterns

- **CTA primario:** pill beige claro → fondo ink sólido, texto beige, hover: iridescent ring.
- **CTA secundario:** ghost con borde ink 1px, hover: background beige con border rose.
- **Product card:** aspect-square, background mint/rose/sky alternando, imagen flotante al centro, hover: scale 1.03 + iridescent glow debajo.
- **Nav:** glass sticky top, logo left, links centrados (DM Sans 500 uppercase 0.18em tracking), cart icon right.
- **Footer:** ink background, beige text, marquee opcional con tagline.

## Anti-patterns (skill guidance)

- ❌ Vibrant block-based palette (ej: rojos saturados, bloques fuertes)
- ❌ Playful colors (amarillos pop, naranjas candy)
- ❌ Emojis como íconos — usar `lucide-react` (stroke 1.5)
- ❌ Pastel colors sobre pastel backgrounds (contrast fail)
- ❌ Animaciones >500ms que no se pueden interrumpir

## Pre-delivery checklist

- [ ] Todo tappable ≥44×44 px y con `cursor-pointer`
- [ ] `prefers-reduced-motion` respetado (morphing off, transitions 150ms)
- [ ] Focus rings visibles (2px iridescent)
- [ ] Responsive verificado en 375 / 768 / 1024 / 1440
- [ ] DM Sans cargado con `font-display: swap`
- [ ] Imágenes holográficas con `loading="lazy"` y dimensiones reservadas
- [ ] Contrast AAA para texto principal (ink sobre beige)

---

*Last updated: 2026-04-23 — generated from brand book PDF + UI Pro Max skill query*

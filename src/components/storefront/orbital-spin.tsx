"use client";

import Image from "next/image";
import { useRef, useState } from "react";

// Drag-to-rotate viewer built from the real product photos. Not a true 36-frame
// turntable (the shoot is a handful of hero angles), so it scrubs through the
// available views — but every frame is a real photo, so quality is perfect.

type Colorway = {
  key: string;
  name: string;
  swatch: string;
  frames: string[];
};

const COLORWAYS: Colorway[] = [
  {
    key: "black",
    name: "Negro",
    swatch: "#1c1c1e",
    frames: [0, 1, 2, 3, 4].map((i) => `/catalog/orbital/spin/black-${i}.png`),
  },
  {
    key: "silver",
    name: "Plata",
    swatch: "#c7cace",
    frames: [0, 1, 2, 3].map((i) => `/catalog/orbital/spin/silver-${i}.png`),
  },
];

const DRAG_PX_PER_FRAME = 45;

export function OrbitalSpin() {
  const [colorIdx, setColorIdx] = useState(0);
  const [frame, setFrame] = useState(0);
  const drag = useRef({ x: 0, active: false, acc: 0, moved: false });

  const cw = COLORWAYS[colorIdx];
  const n = cw.frames.length;

  function pickColor(i: number) {
    setColorIdx(i);
    setFrame((f) => Math.min(f, COLORWAYS[i].frames.length - 1));
  }

  function onDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, active: true, acc: 0, moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.x;
    drag.current.x = e.clientX;
    drag.current.acc += dx;
    if (Math.abs(dx) > 2) drag.current.moved = true;
    while (Math.abs(drag.current.acc) >= DRAG_PX_PER_FRAME) {
      const dir = drag.current.acc > 0 ? 1 : -1;
      drag.current.acc -= dir * DRAG_PX_PER_FRAME;
      setFrame((f) => (f + dir + n) % n);
    }
  }
  function onUp() {
    drag.current.active = false;
  }

  return (
    <div>
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        className="relative aspect-[4/3] cursor-grab touch-none select-none overflow-hidden rounded-[1.5rem] bg-neutral-100 active:cursor-grabbing md:rounded-[2rem]"
      >
        {cw.frames.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt={`Orbital ${cw.name} — vista ${i + 1}`}
            fill
            priority={i === 0}
            sizes="(max-width: 1024px) 100vw, 60vw"
            draggable={false}
            className={`pointer-events-none object-cover transition-opacity duration-150 ${
              i === frame ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}

        {/* Drag hint */}
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-ink/70 px-3 py-1.5 text-[11px] text-brand-beige backdrop-blur">
          ↔ arrastra para girar
        </div>

        {/* Frame progress dots */}
        <div className="pointer-events-none absolute right-3 top-3 flex gap-1">
          {cw.frames.map((_, i) => (
            <span
              key={i}
              className={`size-1.5 rounded-full transition-colors ${
                i === frame ? "bg-brand-ink" : "bg-brand-ink/25"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Colourway selector */}
      <div className="mt-5">
        <p className="eyebrow text-brand-muted mb-3">Color — {cw.name}</p>
        <div className="flex gap-3">
          {COLORWAYS.map((c, i) => (
            <button
              key={c.key}
              type="button"
              onClick={() => pickColor(i)}
              aria-pressed={i === colorIdx}
              className="flex items-center gap-2"
            >
              <span
                className={`grid size-9 place-items-center rounded-full fluid-transition ${
                  i === colorIdx
                    ? "ring-2 ring-brand-ink ring-offset-2 ring-offset-brand-beige"
                    : "ring-1 ring-brand-ink/15 hover:ring-brand-ink/40"
                }`}
              >
                <span
                  className="size-7 rounded-full"
                  style={{ backgroundColor: c.swatch }}
                />
              </span>
              <span
                className={`text-sm fluid-transition ${
                  i === colorIdx ? "text-brand-ink" : "text-brand-muted"
                }`}
              >
                {c.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// A slider panel for framing photographs, so nobody has to guess an
// object-position, reload, squint, and guess again.
//
// ⚠️ DEVELOPMENT ONLY. It is rendered behind a NODE_ENV check in the storefront
// layout, so it is not in the production bundle. It writes nothing to the
// database and nothing to the repo: the output is a className you paste.
//
// Any image can join by carrying two attributes:
//
//   <Image data-framing="brand-world" data-framing-label="02 — brand world" ... />
//
// ── Why it keeps one value per breakpoint ───────────────────────────────────
// A crop that centres a face on a wide desktop band cuts the same face in half
// on a phone, because the aspect ratio of the frame changes and the photograph
// does not. So the panel holds a separate value for each breakpoint, follows
// the window as it is resized, and emits both at once:
//
//   object-[62%_18%] md:object-[55%_30%]
//
// ⚠️ Chrome on Windows will not go below roughly 500px of window width. To
// judge the phone value, use the device toolbar in DevTools rather than
// dragging the window edge, or a narrow window will look like an overflow that
// is not really there.

type Breakpoint = "base" | "md";

/** Tailwind's `md`. Below it, the phone value applies. */
const MD = 768;

type Framing = { x: number; y: number; scale: number };

const DEFAULT: Framing = { x: 50, y: 50, scale: 100 };

const STORAGE_KEY = "allternativ:image-framing";

// Only the identity lives in state. The elements themselves are looked up
// again whenever they are needed: holding a DOM node in state and then writing
// to its style is a mutation of state, which the React compiler rejects, and it
// would also go stale the moment a section re-rendered.
type Target = { id: string; label: string };

const nodeFor = (id: string) =>
  document.querySelector<HTMLElement>(`[data-framing="${id}"]`);

/**
 * Whatever survived the last reload.
 *
 * Read in the state initialiser rather than in an effect. On the server there
 * is no storage and this returns empty, which matches the client's first render
 * because the panel renders nothing until it has found a target.
 */
function restore(): Record<string, Partial<Record<Breakpoint, Framing>>> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    // A corrupt entry is not worth a crash in a dev tool.
    return {};
  }
}

function breakpointFor(width: number): Breakpoint {
  return width >= MD ? "md" : "base";
}

/** `object-[50%_20%]`, or nothing at all when the value is the CSS default. */
function objectClass(f: Framing, prefix: string): string | null {
  if (f.x === 50 && f.y === 50) return null;
  return `${prefix}object-[${f.x}%_${f.y}%]`;
}

function scaleClass(f: Framing, prefix: string): string | null {
  if (f.scale === 100) return null;
  return `${prefix}scale-[${(f.scale / 100).toFixed(2)}]`;
}

export function ImageFramingTool() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bp, setBp] = useState<Breakpoint>("md");
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // A breakpoint stays absent until a slider is actually moved for it, and the
  // painter below skips anything absent. That is what lets a value you have
  // already baked into a className keep showing through: an inline style always
  // beats a class, so a tool that painted every image on sight would quietly
  // hide the very thing you are trying to check.
  const [values, setValues] =
    useState<Record<string, Partial<Record<Breakpoint, Framing>>>>(restore);
  const hydrated = useRef(false);

  // Persist, but not on the very first pass: that one is the restore itself,
  // and writing it straight back would overwrite good storage with `{}` on any
  // render where the read failed.
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  }, [values]);

  // ── Find the images that opted in ─────────────────────────────────────────
  useEffect(() => {
    const scan = () => {
      const found = Array.from(
        document.querySelectorAll<HTMLElement>("[data-framing]"),
      ).map((el) => ({
        id: el.dataset.framing!,
        label: el.dataset.framingLabel || el.dataset.framing!,
      }));
      // Bail out when nothing changed: the MutationObserver below fires on any
      // DOM change, and setting a fresh array every time would loop forever.
      setTargets((prev) =>
        prev.length === found.length &&
        prev.every((t, i) => t.id === found[i].id)
          ? prev
          : found,
      );
      setActiveId((current) =>
        current && found.some((t) => t.id === current)
          ? current
          : (found[0]?.id ?? null),
      );
    };
    scan();
    // Sections further down the page mount as they are streamed in.
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // ── Follow the window, so the panel edits the breakpoint you are looking at ─
  useEffect(() => {
    const onResize = () => {
      setWidth(window.innerWidth);
      setBp(breakpointFor(window.innerWidth));
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const framingFor = useCallback(
    (id: string, at: Breakpoint): Framing => values[id]?.[at] ?? { ...DEFAULT },
    [values],
  );

  // ── Paint only what has been touched at this breakpoint ───────────────────
  useEffect(() => {
    for (const t of targets) {
      const el = nodeFor(t.id);
      if (!el) continue;
      const f = values[t.id]?.[bp];
      if (!f) {
        // Untouched: hand the element back to its className.
        el.style.objectPosition = "";
        el.style.transform = "";
        continue;
      }
      el.style.objectPosition = `${f.x}% ${f.y}%`;
      el.style.transform = f.scale === 100 ? "" : `scale(${f.scale / 100})`;
    }
  }, [targets, bp, values]);

  const current = activeId ? framingFor(activeId, bp) : DEFAULT;

  // Writes only the breakpoint on screen. The other one stays absent until it
  // is edited too, which is what keeps "phone is already fine" meaning exactly
  // that, and keeps the emitted className free of a redundant override.
  const set = (patch: Partial<Framing>) => {
    if (!activeId) return;
    setValues((v) => ({
      ...v,
      [activeId]: {
        ...v[activeId],
        [bp]: { ...framingFor(activeId, bp), ...patch },
      },
    }));
    setCopied(false);
  };

  /** Forget this breakpoint entirely, so the className takes over again. */
  const clearBreakpoint = () => {
    if (!activeId) return;
    setValues((v) => {
      const forId = { ...v[activeId] };
      delete forId[bp];
      return { ...v, [activeId]: forId };
    });
    setCopied(false);
  };

  const output = useMemo(() => {
    if (!activeId) return "";
    const base = values[activeId]?.base;
    const md = values[activeId]?.md;
    const parts = [
      base ? objectClass(base, "") : null,
      // The desktop override is emitted only when it actually differs from the
      // phone value, so the className does not fill up with classes that change
      // nothing.
      md && (!base || base.x !== md.x || base.y !== md.y)
        ? objectClass(md, "md:")
        : null,
      base ? scaleClass(base, "") : null,
      md && (!base || base.scale !== md.scale) ? scaleClass(md, "md:") : null,
    ].filter(Boolean);
    return parts.join(" ") || "(mové un slider)";
  }, [activeId, values]);

  if (!targets.length) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[9999] rounded-full bg-black/85 px-3 py-2 font-mono text-[11px] text-white shadow-lg backdrop-blur"
      >
        ⛶ framing
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-[19rem] rounded-xl bg-black/90 p-3 font-mono text-[11px] text-white shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold tracking-wide">IMAGE FRAMING</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-1 text-white/60 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="mb-2 rounded bg-white/10 px-2 py-1 text-white/70">
        {width}px ·{" "}
        <span className="text-white">
          {bp === "md" ? "desktop (md:)" : "phone (base)"}
        </span>
        {bp === "base" && (
          <span className="block text-[10px] text-amber-300/90">
            Chrome/Windows no baja de ~500px: usá el device toolbar.
          </span>
        )}
      </div>

      <select
        value={activeId ?? ""}
        onChange={(e) => setActiveId(e.target.value)}
        className="mb-3 w-full rounded bg-white/10 px-2 py-1.5 text-white outline-none"
      >
        {targets.map((t) => (
          <option key={t.id} value={t.id} className="bg-neutral-900">
            {t.label}
          </option>
        ))}
      </select>

      {[
        ["Horizontal", "x", 0, 100] as const,
        ["Vertical", "y", 0, 100] as const,
        ["Zoom", "scale", 100, 200] as const,
      ].map(([label, key, min, max]) => (
        <label key={key} className="mb-2 block">
          <span className="flex justify-between text-white/70">
            {label}
            <span className="text-white">{current[key]}%</span>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            value={current[key]}
            onChange={(e) => set({ [key]: Number(e.target.value) })}
            className="w-full accent-white"
          />
        </label>
      ))}

      <div className="mt-3 rounded bg-white/10 p-2">
        <p className="mb-1 text-white/50">
          paste into className
          {activeId && !values[activeId]?.[bp] && (
            <span className="ml-1 text-white/40">
              · {bp === "md" ? "desktop" : "phone"} sin override, manda el
              className
            </span>
          )}
        </p>
        <code className="block break-all text-[10px] leading-relaxed text-emerald-300">
          {output}
        </code>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(output);
            setCopied(true);
          }}
          className="flex-1 rounded bg-white/15 py-1.5 hover:bg-white/25"
        >
          {copied ? "copied ✓" : "copy"}
        </button>
        <button
          type="button"
          onClick={() =>
            activeId && nodeFor(activeId)?.scrollIntoView({ block: "center" })
          }
          className="rounded bg-white/15 px-2 py-1.5 hover:bg-white/25"
        >
          find
        </button>
        <button
          type="button"
          onClick={clearBreakpoint}
          title="Olvida este breakpoint y devuelve la imagen a su className"
          className="rounded bg-white/15 px-2 py-1.5 hover:bg-white/25"
        >
          reset
        </button>
      </div>
    </div>
  );
}

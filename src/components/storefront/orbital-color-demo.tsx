"use client";

import * as THREE from "three";
import Image from "next/image";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Environment,
  Lightformer,
  Bounds,
} from "@react-three/drei";
import { Suspense, useEffect, useMemo, useState } from "react";

const MODEL = "/models/lens-01-test.glb";

type Colorway = {
  key: string;
  name: string;
  swatch: string;
  image: string;
  // null = keep the model's baked texture as-is; otherwise override the whole
  // mesh with a PBR preset (Corinthian-style whole-model tint).
  material: null | { color: string; metalness: number; roughness: number };
};

const COLORWAYS: Colorway[] = [
  {
    key: "black",
    name: "Negro",
    swatch: "#1c1c1e",
    image: "/catalog/orbital/black.webp",
    // Clean studio material instead of the speckled baked texture.
    material: { color: "#1a1a1c", metalness: 0.25, roughness: 0.45 },
  },
  {
    key: "silver",
    name: "Plata",
    swatch: "#c7cace",
    image: "/catalog/orbital/silver.webp",
    material: { color: "#cfd2d8", metalness: 1, roughness: 0.28 },
  },
];

function OrbitalModel({ colorway }: { colorway: Colorway }) {
  const { scene } = useGLTF(MODEL);

  // Capture the original baked materials once so we can restore them.
  const originals = useMemo(() => {
    const map = new Map<string, THREE.MeshStandardMaterial>();
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        map.set(mesh.uuid, mesh.material as THREE.MeshStandardMaterial);
      }
    });
    return map;
  }, [scene]);

  useEffect(() => {
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const original = originals.get(mesh.uuid);
      if (!original) return;

      if (!colorway.material) {
        mesh.material = original; // baked black
        return;
      }

      const m = original.clone();
      m.map = null; // drop the baked black so the preset colour reads true
      m.color = new THREE.Color(colorway.material.color);
      m.metalness = colorway.material.metalness;
      m.roughness = colorway.material.roughness;
      m.envMapIntensity = 1.3;
      m.needsUpdate = true;
      mesh.material = m;
    });
  }, [scene, colorway, originals]);

  return <primitive object={scene} />;
}

function Loading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
        <span className="text-sm text-neutral-500">Cargando 3D…</span>
      </div>
    </div>
  );
}

export function OrbitalColorDemo() {
  const [active, setActive] = useState(0);
  const colorway = COLORWAYS[active];

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
      {/* 3D — recolours with the selected colourway */}
      <div className="relative aspect-square overflow-hidden rounded-[1.5rem] bg-neutral-100 md:rounded-[2rem]">
        <Suspense fallback={<Loading />}>
          <Canvas
            camera={{ position: [0, 0, 3], fov: 40 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
            style={{ touchAction: "none" }}
          >
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 5, 5]} intensity={1} />
            <directionalLight position={[-3, 3, -3]} intensity={0.4} />

            <Bounds fit clip observe margin={1.2}>
              <OrbitalModel colorway={colorway} />
            </Bounds>

            <Environment resolution={256}>
              <Lightformer intensity={2.2} position={[0, 1.5, 2]} scale={[4, 4, 1]} color="#ffffff" />
              <Lightformer intensity={1.1} position={[-2.5, 0, 1.5]} scale={[3, 2, 1]} color="#e8ecff" />
              <Lightformer intensity={1.1} position={[2.5, 0, 1.5]} scale={[3, 2, 1]} color="#fff0f6" />
              <Lightformer form="ring" intensity={0.6} position={[0, -2, 1]} scale={[3, 3, 1]} color="#ffffff" />
            </Environment>

            <OrbitControls makeDefault enablePan={false} enableZoom />
          </Canvas>
        </Suspense>
        <span className="eyebrow pointer-events-none absolute bottom-3 left-4 text-[10px] text-neutral-400">
          3D · arrastra para girar
        </span>
      </div>

      {/* Photo — swaps with the selected colourway */}
      <div className="flex flex-col">
        <div className="relative aspect-square overflow-hidden rounded-[1.5rem] bg-neutral-100 md:rounded-[2rem]">
          {COLORWAYS.map((c, i) => (
            <Image
              key={c.key}
              src={c.image}
              alt={`Orbital — ${c.name}`}
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              priority={i === 0}
              className={`object-cover fluid-transition ${
                i === active ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
          <span className="eyebrow pointer-events-none absolute bottom-3 left-4 text-[10px] text-brand-ink/40">
            foto real
          </span>
        </div>
      </div>

      {/* Colourway selector — controls both panels */}
      <div className="lg:col-span-2">
        <p className="eyebrow text-brand-muted mb-3">
          Color — {colorway.name}
        </p>
        <div className="flex gap-3">
          {COLORWAYS.map((c, i) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              className="group flex items-center gap-2"
            >
              <span
                className={`grid size-9 place-items-center rounded-full fluid-transition ${
                  i === active
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
                  i === active ? "text-brand-ink" : "text-brand-muted"
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

useGLTF.preload(MODEL);

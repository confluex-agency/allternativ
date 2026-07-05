"use client";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Environment,
  Lightformer,
  Bounds,
} from "@react-three/drei";
import { Suspense } from "react";

// Throwaway inspector for judging a freshly generated GLB. Auto-fits the camera
// to the model's bounding box (via <Bounds>), so it doesn't matter what scale
// or origin Higgsfield/Meshy exported — the piece always lands centered.

function Model({ src }: { src: string }) {
  const { scene } = useGLTF(src);
  return <primitive object={scene} />;
}

function Loading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
        <span className="text-sm text-neutral-500">Cargando modelo…</span>
      </div>
    </div>
  );
}

export function ModelInspector({
  src,
  className = "",
}: {
  src: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-neutral-100 ${className}`}
    >
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
            <Model src={src} />
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

      <div className="pointer-events-none absolute bottom-3 left-3 select-none text-[11px] text-neutral-400">
        Arrastra para girar · Scroll para zoom
      </div>
    </div>
  );
}

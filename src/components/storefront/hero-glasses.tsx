"use client";

import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Suspense, useRef } from "react";

const MODEL_PATH = "/models/glasses-web.glb";

// Hero-only presentation of the glasses: no controls, auto-rotating, floating,
// transparent background so it sits over the iridescent hero. The interactive
// viewer (drag/zoom/color) lives on the product pages instead.
function SpinningGlasses({ reduced }: { reduced: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const { scene } = useGLTF(MODEL_PATH, undefined, true);

  useFrame((state, delta) => {
    const g = ref.current;
    if (!g) return;
    if (reduced) {
      // Fixed three-quarter pose, no motion.
      g.rotation.set(0.05, -0.5, 0);
      return;
    }
    const t = state.clock.elapsedTime;
    g.rotation.y += delta * 0.45; // slow continuous spin
    g.rotation.x = Math.sin(t * 0.5) * 0.1; // gentle tilt
    g.position.y = Math.sin(t * 0.9) * 0.006; // subtle float
  });

  return (
    <group ref={ref}>
      <primitive object={scene} />
    </group>
  );
}

export function HeroGlasses() {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className="relative h-full w-full">
      {/* frequency glow behind the glasses */}
      <span aria-hidden="true" className="hero-freq-glow" />
      <Canvas
        camera={{ position: [0, 0.04, 0.42], fov: 30 }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        style={{ background: "transparent" }}
        dpr={[1, 2]}
      >
        {/* No external HDR env (avoids a CDN fetch); local rig instead */}
        <ambientLight intensity={0.9} />
        <hemisphereLight args={["#ffffff", "#b8a9d9", 0.7]} />
        <directionalLight position={[5, 5, 5]} intensity={1.4} />
        <directionalLight position={[-4, 2, -3]} intensity={0.6} color="#ffd6e8" />
        <directionalLight position={[0, -2, 4]} intensity={0.5} color="#b8f2e6" />
        <Suspense fallback={null}>
          <SpinningGlasses reduced={reduced} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_PATH);

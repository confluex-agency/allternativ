"use client";

import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Center } from "@react-three/drei";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";

const MODEL_PATH = "/models/glasses-web.glb";

// Placeholder frame color for the hero. A dark graphite reads as a real pair
// (vs the washed white default) and separates from the light iridescent hero.
// Trivial to swap per product later (e.g. Orbital plomo, a black model, etc.).
const FRAME_TINT = "#3f3b38";

// Hero-only presentation of the glasses: no controls, auto-rotating, transparent
// background so it floats over the iridescent hero. Framed by the model's
// BOUNDING SPHERE (rotation-invariant) and refit on resize, so the glasses stay
// fully in frame at any viewport width and at every angle of the spin.
function Glasses({ reduced }: { reduced: boolean }) {
  const original = useGLTF(MODEL_PATH, undefined, true).scene;
  // Clone so we don't mutate the shared cached scene used by the product viewer.
  const scene = useMemo(() => {
    const clone = original.clone(true);
    const tint = new THREE.Color(FRAME_TINT);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      // Clone the material too (clone(true) shares materials by reference).
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      mat.color.multiply(tint);
      mesh.material = mat;
    });
    return clone;
  }, [original]);
  const group = useRef<THREE.Group>(null);
  const { camera, size } = useThree();

  // Bounding-sphere radius (rotation-invariant) for framing. Centering itself is
  // handled by drei's <Center> below, which is more reliable than a manual offset.
  const radius = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    return box.getBoundingSphere(new THREE.Sphere()).radius;
  }, [scene]);

  // Distance the camera needs so the whole bounding sphere fits the container,
  // using whichever field of view (vertical or horizontal) is tighter.
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(size.height, 1);
    const vFov = (cam.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const effFov = Math.min(vFov, hFov);
    // <1 frames tighter than the full bounding sphere (which is inflated by the
    // temple depth), so the glasses read larger. Temples may skim the edge at
    // extreme spin angles, which is fine for this floating hero treatment.
    const margin = 0.92;
    const dist = (radius / Math.sin(effFov / 2)) * margin;
    cam.position.set(0, 0, dist);
    cam.near = dist - radius * 2;
    cam.far = dist + radius * 2;
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
  }, [camera, size, radius]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    if (reduced) {
      g.rotation.set(0.05, -0.5, 0); // fixed three-quarter pose, no motion
      return;
    }
    g.rotation.y += delta * 0.45; // continuous spin (kept — the client likes it)
    g.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.1; // gentle tilt
  });

  // Spin group OUTSIDE, <Center> INSIDE: the model's bounding-box center sits on
  // the group's rotation pivot, so it spins in place instead of arcing off-frame.
  return (
    <group ref={group}>
      <Center>
        <primitive object={scene} />
      </Center>
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
        camera={{ fov: 30, position: [0, 0, 1] }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        style={{
          background: "transparent",
          // soft floating shadow so the glasses lift off the light hero
          filter: "drop-shadow(0 14px 26px rgba(35,25,15,0.32))",
        }}
        dpr={[1, 2]}
      >
        {/* No external HDR env (avoids a CDN fetch); local rig instead */}
        <ambientLight intensity={0.9} />
        <hemisphereLight args={["#ffffff", "#b8a9d9", 0.7]} />
        <directionalLight position={[5, 5, 5]} intensity={1.4} />
        <directionalLight position={[-4, 2, -3]} intensity={0.6} color="#ffd6e8" />
        <directionalLight position={[0, -2, 4]} intensity={0.5} color="#b8f2e6" />
        <Suspense fallback={null}>
          <Glasses reduced={reduced} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_PATH);

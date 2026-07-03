"use client";

import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Center } from "@react-three/drei";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";

const MODEL_PATH = "/models/manuel-head.glb";

// Manuel's stylized head wearing the glasses. Meshopt-compressed GLB (~450KB).
// The nape reconstructed with hair, so a full spin is safe; we keep the camera at
// eye level so it never looks up into the open neck base. Texture is baked, so we
// light it softly to avoid double-shading.
function Head() {
  const original = useGLTF(MODEL_PATH, undefined, true).scene;
  const scene = useMemo(() => original.clone(true), [original]);
  const group = useRef<THREE.Group>(null);
  const { camera, size } = useThree();

  const radius = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    return box.getBoundingSphere(new THREE.Sphere()).radius;
  }, [scene]);

  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(size.height, 1);
    const vFov = (cam.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const effFov = Math.min(vFov, hFov);
    const margin = 1.15;
    const dist = (radius / Math.sin(effFov / 2)) * margin;
    cam.position.set(0, 0, dist);
    cam.near = dist - radius * 2;
    cam.far = dist + radius * 2;
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
  }, [camera, size, radius]);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.35; // slow spin
  });

  return (
    <group ref={group}>
      <Center>
        <primitive object={scene} />
      </Center>
    </group>
  );
}

export function HeroHead() {
  return (
    <div className="relative h-full w-full">
      <span aria-hidden="true" className="hero-freq-glow" />
      <Canvas
        camera={{ fov: 30, position: [0, 0, 1] }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
        style={{
          background: "transparent",
          filter: "drop-shadow(0 16px 30px rgba(35,25,15,0.28))",
        }}
        dpr={[1, 2]}
      >
        {/* Soft, even lighting — the texture already carries baked shading */}
        <ambientLight intensity={1.0} />
        <hemisphereLight args={["#ffffff", "#e7c9d6", 0.6]} />
        <directionalLight position={[3, 4, 5]} intensity={0.8} />
        <directionalLight position={[-4, 1, -2]} intensity={0.35} color="#ffd6e8" />
        <Suspense fallback={null}>
          <Head />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_PATH);

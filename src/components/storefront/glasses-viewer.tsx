"use client";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Environment,
  Lightformer,
  ContactShadows,
} from "@react-three/drei";
import { Suspense, useEffect, useState, useCallback } from "react";

const MODEL_PATH = "/models/glasses-web.glb";

const COLOR_OPTIONS = [
  { name: "Original", color: "#ffffff", label: "OG" },
  { name: "Amber", color: "#d4a054", label: "AM" },
  { name: "Rose", color: "#c47a8a", label: "RS" },
  { name: "Ocean", color: "#5b8fa8", label: "OC" },
  { name: "Forest", color: "#6a8a5b", label: "FR" },
  { name: "Midnight", color: "#3a3a5c", label: "MN" },
];

function GlassesModel({ tint }: { tint: string }) {
  const { scene } = useGLTF(MODEL_PATH, undefined, true);

  useEffect(() => {
    const color = new THREE.Color(tint);
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (!mat.userData.originalColor) {
          mat.userData.originalColor = mat.color.clone();
        }
        mat.color.copy(mat.userData.originalColor).multiply(color);
        mat.needsUpdate = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [scene, tint]);

  return <primitive object={scene} scale={1} position={[0, 0, 0]} />;
}

function LoadingSpinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
        <span className="text-sm text-neutral-500">Loading 3D model...</span>
      </div>
    </div>
  );
}

export function GlassesViewer({ className = "" }: { className?: string }) {
  const [activeColor, setActiveColor] = useState(0);

  const handleColorChange = useCallback((index: number) => {
    setActiveColor(index);
  }, []);

  return (
    <div className={`relative bg-neutral-50 rounded-lg overflow-hidden ${className}`}>
      <Suspense fallback={<LoadingSpinner />}>
        <Canvas
          camera={{ position: [0, 0.05, 0.35], fov: 30 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
          style={{ touchAction: "none" }}
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
          <directionalLight position={[-3, 3, -3]} intensity={0.4} />

          <GlassesModel tint={COLOR_OPTIONS[activeColor].color} />

          <ContactShadows
            position={[0, -0.03, 0]}
            opacity={0.4}
            scale={0.5}
            blur={2}
          />

          {/* Self-contained studio env — reflections without any external HDR
              fetch, so the strict CSP never blocks it. */}
          <Environment resolution={256}>
            <Lightformer
              intensity={2.2}
              position={[0, 1.5, 2]}
              scale={[4, 4, 1]}
              color="#ffffff"
            />
            <Lightformer
              intensity={1.1}
              position={[-2.5, 0, 1.5]}
              scale={[3, 2, 1]}
              color="#e8ecff"
            />
            <Lightformer
              intensity={1.1}
              position={[2.5, 0, 1.5]}
              scale={[3, 2, 1]}
              color="#fff0f6"
            />
            <Lightformer
              form="ring"
              intensity={0.6}
              position={[0, -2, 1]}
              scale={[3, 3, 1]}
              color="#ffffff"
            />
          </Environment>

          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={0.15}
            maxDistance={1}
            target={[0, 0, 0]}
          />
        </Canvas>
      </Suspense>

      {/* Color picker — horizontal on phones (short landscape frame), vertical
          on larger screens where there's height to spare. */}
      <div className="absolute top-3 right-3 flex flex-row-reverse gap-2 md:flex-col">
        {COLOR_OPTIONS.map((opt, i) => (
          <button
            key={opt.name}
            onClick={() => handleColorChange(i)}
            title={opt.name}
            className={`w-7 h-7 rounded-full border-2 transition-all ${
              activeColor === i
                ? "border-neutral-900 scale-110"
                : "border-neutral-300 hover:border-neutral-500"
            }`}
            style={{ backgroundColor: opt.color === "#ffffff" ? "#e5e5e5" : opt.color }}
          />
        ))}
      </div>

      <div className="absolute bottom-3 left-3 text-[11px] text-neutral-400 pointer-events-none select-none">
        Drag to rotate &middot; Scroll to zoom
      </div>
    </div>
  );
}

useGLTF.preload(MODEL_PATH);

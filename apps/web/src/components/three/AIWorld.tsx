"use client";

import React, { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { IntelligenceCore } from "./IntelligenceCore";
import { OrbitalRings } from "./OrbitalRings";
import { ParticleField } from "./ParticleField";
import { KnowledgeConstellation } from "./KnowledgeConstellation";
import { AudioReactiveHalo } from "./AudioReactiveHalo";
import { CameraRig } from "./CameraRig";
import { useTutorStore } from "@/lib/store";

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.3} color="#94a3b8" />
      <directionalLight position={[4, 6, 3]} intensity={0.6} color="#bae6fd" />
      <pointLight position={[-4, 2, 2]} intensity={0.3} color="#22d3ee" />
      <pointLight position={[3, -2, -2]} intensity={0.2} color="#818cf8" />
    </>
  );
}

export function AIWorld() {
  const quality = useTutorStore((s) => s.quality);
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) setHasWebGL(false);
    } catch {
      setHasWebGL(false);
    }
  }, []);

  if (!hasWebGL) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-midnight-950 text-slate-400 font-mono text-sm">
        WebGL is unavailable in your browser environment. Core AI systems running in 2D mode.
      </div>
    );
  }

  const dpr = quality === "ultra" ? [1, 2] : quality === "low" ? 1 : [1, 1.5];

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-auto bg-midnight-950">
      {/* Subtle radial vignette overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(3,6,15,0.75)_80%)]" />

      <Canvas
        camera={{ position: [0, 0.4, 4.6], fov: 42 }}
        dpr={dpr as any} // eslint-disable-line @typescript-eslint/no-explicit-any
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        <color attach="background" args={["#03060f"]} />
        <fog attach="fog" args={["#03060f", 4.5, 14]} />

        <Suspense fallback={null}>
          <SceneLighting />
          <CameraRig />

          <group position={[0, 0, 0]}>
            <IntelligenceCore />
            <OrbitalRings />
            <ParticleField />
            <KnowledgeConstellation />
            <AudioReactiveHalo />
          </group>
        </Suspense>
      </Canvas>
    </div>
  );
}


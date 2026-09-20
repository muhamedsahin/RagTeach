"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTutorStore } from "@/lib/store";

export function AudioReactiveHalo() {
  const halo1 = useRef<THREE.Mesh>(null);
  const halo2 = useRef<THREE.Mesh>(null);
  const halo3 = useRef<THREE.Mesh>(null);

  const audioMetrics = useTutorStore((s) => s.audioMetrics);
  const tutorState = useTutorStore((s) => s.tutorState);
  const userSpeechRMS = useTutorStore((s) => s.userSpeechRMS);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    // AI voice amplitude or user mic RMS
    const energy =
      tutorState === "speaking"
        ? audioMetrics.amplitude
        : tutorState === "listening"
        ? userSpeechRMS * 2.5
        : 0;

    const baseRadius = 1.6;

    if (halo1.current) {
      const scale1 = baseRadius + Math.sin(time * 3 + 0) * 0.15 + energy * 0.3;
      halo1.current.scale.setScalar(scale1);
      const mat = halo1.current.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, energy > 0.05 ? 0.20 : 0.08, delta * 4);
    }

    if (halo2.current) {
      const scale2 = baseRadius + 0.35 + Math.sin(time * 3 + 1.2) * 0.15 + energy * 0.4;
      halo2.current.scale.setScalar(scale2);
      const mat = halo2.current.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, energy > 0.05 ? 0.12 : 0.05, delta * 4);
    }

    if (halo3.current) {
      const scale3 = baseRadius + 0.75 + Math.sin(time * 3 + 2.4) * 0.15 + energy * 0.5;
      halo3.current.scale.setScalar(scale3);
      const mat = halo3.current.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, energy > 0.05 ? 0.06 : 0.02, delta * 4);
    }
  });

  const haloColor = tutorState === "listening" ? "#99f6e4" : "#93c5fd";

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh ref={halo1}>
        <ringGeometry args={[1.0, 1.025, 64]} />
        <meshBasicMaterial
          color={haloColor}
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh ref={halo2}>
        <ringGeometry args={[1.0, 1.02, 64]} />
        <meshBasicMaterial
          color={haloColor}
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh ref={halo3}>
        <ringGeometry args={[1.0, 1.015, 64]} />
        <meshBasicMaterial
          color={haloColor}
          transparent
          opacity={0.05}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}


"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTutorStore } from "@/lib/store";

export function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null);

  const tutorState = useTutorStore((s) => s.tutorState);
  const audioMetrics = useTutorStore((s) => s.audioMetrics);
  const quality = useTutorStore((s) => s.quality);

  const particleCount = useMemo(() => {
    switch (quality) {
      case "ultra":
        return 1300;
      case "high":
        return 900;
      case "medium":
        return 500;
      case "low":
        return 250;
      default:
        return 800;
    }
  }, [quality]);

  const { positions, originalRadii, angles, speeds, inclinations, colors } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const rad = new Float32Array(particleCount);
    const ang = new Float32Array(particleCount);
    const spd = new Float32Array(particleCount);
    const inc = new Float32Array(particleCount);
    const cols = new Float32Array(particleCount * 3);

    const colorA = new THREE.Color("#bae6fd");
    const colorB = new THREE.Color("#93c5fd");
    const colorC = new THREE.Color("#c4b5fd");

    for (let i = 0; i < particleCount; i++) {
      // Distribute particles in a shell around core (radius 1.8 to 6.5)
      const radius = 1.8 + Math.pow(Math.random(), 1.5) * 4.8;
      const angle = Math.random() * Math.PI * 2;
      const inclination = (Math.random() - 0.5) * Math.PI * 0.85;
      const speed = (0.08 + Math.random() * 0.25) * (Math.random() > 0.5 ? 1 : -1);

      rad[i] = radius;
      ang[i] = angle;
      inc[i] = inclination;
      spd[i] = speed;

      pos[i * 3] = radius * Math.cos(angle) * Math.cos(inclination);
      pos[i * 3 + 1] = radius * Math.sin(inclination);
      pos[i * 3 + 2] = radius * Math.sin(angle) * Math.cos(inclination);

      // Gradient color interpolation
      const mixFactor = Math.random();
      const mixedColor =
        mixFactor < 0.5
          ? colorA.clone().lerp(colorB, mixFactor * 2)
          : colorB.clone().lerp(colorC, (mixFactor - 0.5) * 2);

      cols[i * 3] = mixedColor.r;
      cols[i * 3 + 1] = mixedColor.g;
      cols[i * 3 + 2] = mixedColor.b;
    }

    return {
      positions: pos,
      originalRadii: rad,
      angles: ang,
      speeds: spd,
      inclinations: inc,
      colors: cols,
    };
  }, [particleCount]);

  const geo = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  }, [positions, colors]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const time = state.clock.getElapsedTime();
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;

    let speedMultiplier = 1.0;
    if (tutorState === "thinking") speedMultiplier = 1.2;
    else if (tutorState === "retrieving") speedMultiplier = 1.4;
    else if (tutorState === "speaking") speedMultiplier = 1.3 + audioMetrics.treble * 1.5;
    else if (tutorState === "paused") speedMultiplier = 0.25;

    const audioExpansion = audioMetrics.amplitude * 0.15;

    for (let i = 0; i < particleCount; i++) {
      angles[i] += delta * speeds[i] * speedMultiplier;
      const currentAngle = angles[i];
      const inclination = inclinations[i];
      const baseRadius = originalRadii[i];

      // Subtle breathing float
      const r = baseRadius + Math.sin(time * 1.2 + i) * 0.08 + audioExpansion;

      // When listening, particles lean gently forward toward camera
      const zBias = tutorState === "listening" ? 0.35 : 0;

      posArray[i * 3] = r * Math.cos(currentAngle) * Math.cos(inclination);
      posArray[i * 3 + 1] = r * Math.sin(inclination) + Math.sin(time * 0.8 + currentAngle) * 0.05;
      posArray[i * 3 + 2] = r * Math.sin(currentAngle) * Math.cos(inclination) + zBias;
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geo}>
      <pointsMaterial
        size={0.022}
        vertexColors
        transparent
        opacity={0.35}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}


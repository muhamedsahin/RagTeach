"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTutorStore } from "@/lib/store";

export function OrbitalRings() {
  const ring1Ref = useRef<THREE.Group>(null);
  const ring2Ref = useRef<THREE.Group>(null);
  const ring3Ref = useRef<THREE.Group>(null);

  const tutorState = useTutorStore((s) => s.tutorState);
  const audioMetrics = useTutorStore((s) => s.audioMetrics);

  useFrame((_, delta) => {
    let speedMult = 1.0;
    if (tutorState === "thinking") speedMult = 1.3;
    else if (tutorState === "retrieving") speedMult = 1.5;
    else if (tutorState === "speaking") speedMult = 1.4 + audioMetrics.mid * 1.2;
    else if (tutorState === "paused" || tutorState === "interrupted") speedMult = 0.2;

    const audioExpansion = audioMetrics.mid * 0.12;

    if (ring1Ref.current) {
      ring1Ref.current.rotation.z += delta * 0.22 * speedMult;
      ring1Ref.current.rotation.x += delta * 0.11 * speedMult;
      ring1Ref.current.scale.setScalar(1.0 + audioExpansion);
    }

    if (ring2Ref.current) {
      ring2Ref.current.rotation.y += delta * 0.18 * speedMult;
      ring2Ref.current.rotation.z -= delta * 0.14 * speedMult;
      ring2Ref.current.scale.setScalar(1.0 + audioExpansion * 1.3);
    }

    if (ring3Ref.current) {
      ring3Ref.current.rotation.x -= delta * 0.15 * speedMult;
      ring3Ref.current.rotation.y -= delta * 0.25 * speedMult;
      ring3Ref.current.scale.setScalar(1.0 + audioExpansion * 0.8);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Primary Equatorial Ring with Trackers */}
      <group ref={ring1Ref} rotation={[0.4, 0.2, 0]}>
        <mesh>
          <ringGeometry args={[2.0, 2.016, 96]} />
          <meshBasicMaterial
            color="#bae6fd"
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        {/* Coordinate tick markers on ring */}
        <mesh position={[2.008, 0, 0]}>
          <boxGeometry args={[0.06, 0.02, 0.02]} />
          <meshBasicMaterial color="#bae6fd" blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh position={[-2.008, 0, 0]}>
          <boxGeometry args={[0.06, 0.02, 0.02]} />
          <meshBasicMaterial color="#bae6fd" blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh position={[0, 2.008, 0]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshBasicMaterial color="#93c5fd" blending={THREE.AdditiveBlending} />
        </mesh>
      </group>

      {/* Secondary Inclined Gyroscopic Ring */}
      <group ref={ring2Ref} rotation={[-0.6, 0.5, 0.8]}>
        <mesh>
          <ringGeometry args={[2.45, 2.464, 96]} />
          <meshBasicMaterial
            color="#93c5fd"
            transparent
            opacity={0.10}
            side={THREE.DoubleSide}
            blending={THREE.NormalBlending}
          />
        </mesh>
        <mesh position={[2.457, 0, 0]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshBasicMaterial color="#c4b5fd" blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh position={[0, -2.457, 0]}>
          <boxGeometry args={[0.04, 0.04, 0.04]} />
          <meshBasicMaterial color="#99f6e4" blending={THREE.AdditiveBlending} />
        </mesh>
      </group>

      {/* Tertiary Outer Delicate Ring */}
      <group ref={ring3Ref} rotation={[0.8, -0.3, -0.5]}>
        <mesh>
          <ringGeometry args={[2.9, 2.912, 96]} />
          <meshBasicMaterial
            color="#a5b4fc"
            transparent
            opacity={0.06}
            side={THREE.DoubleSide}
            blending={THREE.NormalBlending}
          />
        </mesh>
        <mesh position={[-2.906, 0, 0]}>
          <octahedronGeometry args={[0.04, 0]} />
          <meshBasicMaterial color="#bae6fd" blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </group>
  );
}


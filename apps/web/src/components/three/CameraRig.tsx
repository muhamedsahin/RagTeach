"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useTutorStore } from "@/lib/store";

export function CameraRig() {
  const { camera, pointer } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 0.4, 4.6));
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));

  const tutorState = useTutorStore((s) => s.tutorState);
  const interactionMode = useTutorStore((s) => s.interactionMode);

  useFrame((_, delta) => {
    // Determine base Z-distance based on mode & state
    let targetZ = 4.6;
    let targetY = 0.35;

    if (interactionMode === "voice") {
      targetZ = 3.9;
    } else if (interactionMode === "text") {
      targetZ = 5.2;
    }

    if (tutorState === "retrieving" || tutorState === "thinking") {
      targetZ -= 0.35;
    }

    // Gentle mouse parallax
    const parallaxX = pointer.x * 0.45;
    const parallaxY = pointer.y * 0.3;

    targetPos.current.set(parallaxX, targetY + parallaxY, targetZ);

    // Smooth camera damping
    camera.position.lerp(targetPos.current, Math.min(1, delta * 3.5));

    // Smooth look-at center
    const lookTarget = new THREE.Vector3(parallaxX * 0.2, parallaxY * 0.15, 0);
    currentLookAt.current.lerp(lookTarget, Math.min(1, delta * 4));
    camera.lookAt(currentLookAt.current);
  });

  return null;
}


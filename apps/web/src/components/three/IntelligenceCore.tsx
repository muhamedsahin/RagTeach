"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTutorStore } from "@/lib/store";

const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uDistortion;
  uniform float uFrequency;

  // Simple 3D noise approximation
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    float noise = snoise(position * uFrequency + vec3(uTime * 0.45));
    vec3 displaced = position + normal * (noise * uDistortion);
    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  uniform vec3 uColorCore;
  uniform vec3 uColorGlow;
  uniform float uAlpha;
  uniform float uFresnelIntensity;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Subtle Fresnel rim glow
    float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
    fresnel = pow(fresnel, 2.4) * uFresnelIntensity;

    vec3 color = mix(uColorCore, uColorGlow, fresnel);
    gl_FragColor = vec4(color, uAlpha * (0.4 + fresnel * 0.6));
  }
`;

export function IntelligenceCore() {
  const meshRef = useRef<THREE.Mesh>(null);
  const innerMeshRef = useRef<THREE.Mesh>(null);
  const latticeRef = useRef<THREE.Group>(null);

  const tutorState = useTutorStore((s) => s.tutorState);
  const audioMetrics = useTutorStore((s) => s.audioMetrics);
  const userSpeechRMS = useTutorStore((s) => s.userSpeechRMS);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDistortion: { value: 0.12 },
      uFrequency: { value: 1.6 },
      uColorCore: { value: new THREE.Color("#0f172a") },
      uColorGlow: { value: new THREE.Color("#7dd3fc") },
      uAlpha: { value: 0.4 },
      uFresnelIntensity: { value: 0.6 },
    }),
    []
  );

  const innerUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDistortion: { value: 0.2 },
      uFrequency: { value: 2.2 },
      uColorCore: { value: new THREE.Color("#020817") },
      uColorGlow: { value: new THREE.Color("#38bdf8") },
      uAlpha: { value: 0.5 },
      uFresnelIntensity: { value: 0.8 },
    }),
    []
  );

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    uniforms.uTime.value = time;
    innerUniforms.uTime.value = time;

    // State-dependent target attributes
    let targetDistortion = 0.08;
    let targetScale = 1.0;
    let targetGlowColor = new THREE.Color("#7dd3fc"); // Default cyan
    let targetCoreColor = new THREE.Color("#0f172a");
    let rotSpeed = 0.15;

    switch (tutorState) {
      case "idle":
        targetDistortion = 0.03;
        targetScale = 0.96 + Math.sin(time * 1.5) * 0.03;
        targetGlowColor.set("#93c5fd");
        rotSpeed = 0.108;
        break;

      case "listening":
        // Reacts directly to student's microphone RMS volume
        targetDistortion = 0.14 + userSpeechRMS * 0.4;
        targetScale = 1.06 + userSpeechRMS * 0.35;
        targetGlowColor.set("#99f6e4"); // Soft turquoise
        rotSpeed = 0.21;
        break;

      case "thinking":
        targetDistortion = 0.22;
        targetScale = 1.08 + Math.sin(time * 5.0) * 0.05;
        targetGlowColor.set("#a5b4fc"); // Subtle energetic violet
        rotSpeed = 0.51;
        break;

      case "retrieving":
        targetDistortion = 0.12;
        targetScale = 1.12;
        targetGlowColor.set("#67e8f9");
        rotSpeed = 0.72;
        break;

      case "teaching":
      case "speaking": {
        const voiceBoost = audioMetrics.amplitude * 0.5 + audioMetrics.bass * 0.4;
        targetDistortion = 0.12 + voiceBoost * 0.25;
        targetScale = 1.0 + voiceBoost * 0.28;
        targetGlowColor.set(audioMetrics.bass > 0.4 ? "#93c5fd" : "#7dd3fc");
        rotSpeed = 0.24 + voiceBoost * 0.36;
        break;
      }

      case "interrupted":
        targetDistortion = 0.04;
        targetScale = 0.92;
        targetGlowColor.set("#fda4af"); // Brief subtle warning rose/coral
        rotSpeed = 0.03;
        break;

      case "paused":
        targetDistortion = 0.03;
        targetScale = 0.94;
        targetGlowColor.set("#64748b");
        rotSpeed = 0.048;
        break;
    }

    // Smooth lerping
    const lerpRate = Math.min(1, delta * 5.5);
    uniforms.uDistortion.value = THREE.MathUtils.lerp(
      uniforms.uDistortion.value,
      targetDistortion,
      lerpRate
    );
    uniforms.uColorGlow.value.lerp(targetGlowColor, lerpRate);
    uniforms.uColorCore.value.lerp(targetCoreColor, lerpRate);

    if (meshRef.current) {
      const currentScale = meshRef.current.scale.x;
      const nextScale = THREE.MathUtils.lerp(currentScale, targetScale, lerpRate);
      meshRef.current.scale.setScalar(nextScale);
      meshRef.current.rotation.y += delta * rotSpeed;
      meshRef.current.rotation.x = Math.sin(time * 0.6) * 0.12;
    }

    if (innerMeshRef.current) {
      innerMeshRef.current.rotation.y -= delta * (rotSpeed * 1.3);
      innerMeshRef.current.rotation.z += delta * (rotSpeed * 0.8);
      const innerScale = (targetScale * 0.72) + Math.sin(time * 2.5) * 0.03;
      innerMeshRef.current.scale.setScalar(innerScale);
    }

    if (latticeRef.current) {
      latticeRef.current.rotation.x += delta * (rotSpeed * 0.5);
      latticeRef.current.rotation.y += delta * (rotSpeed * 0.7);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Outer Volumetric Shader Shell */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.35, 36]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Inner Fluid Energy Core */}
      <mesh ref={innerMeshRef}>
        <sphereGeometry args={[0.92, 32, 32]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={innerUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Internal Geometric Lattice Wireframe */}
      <group ref={latticeRef}>
        <mesh>
          <octahedronGeometry args={[0.75, 1]} />
          <meshBasicMaterial
            color="#67e8f9"
            wireframe
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh rotation={[0.4, 0.4, 0.4]}>
          <dodecahedronGeometry args={[0.55, 0]} />
          <meshBasicMaterial
            color="#38bdf8"
            wireframe
            transparent
            opacity={0.10}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
    </group>
  );
}


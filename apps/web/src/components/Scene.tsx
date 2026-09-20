"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getSessionSnapshot, subscribeSession } from "@/lib/store";

/**
 * Vanilla Three.js scene — avoids @react-three/fiber reconciler
 * conflicts (ReactCurrentOwner) under Next.js.
 */
export function Scene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef({ sessionState: "idle", amplitude: 0 });

  useEffect(() => {
    const sync = () => {
      const s = getSessionSnapshot();
      liveRef.current = { sessionState: s.sessionState, amplitude: s.amplitude };
    };
    sync();
    return subscribeSession(sync);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#071018");
    scene.fog = new THREE.Fog("#071018", 6, 18);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0.6, 4.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const key = new THREE.DirectionalLight(0xd7ecff, 1.3);
    key.position.set(4, 6, 2);
    scene.add(key);
    const accent = new THREE.PointLight(0x3ecfb2, 1.1, 20);
    accent.position.set(-3, 2, 2);
    scene.add(accent);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: "#071018" }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.7;
    scene.add(floor);

    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 12),
      new THREE.MeshStandardMaterial({ color: "#102038" }),
    );
    wall.position.set(0, 4, -8);
    scene.add(wall);

    const orbGeo = new THREE.IcosahedronGeometry(1.15, 3);
    const orbMat = new THREE.MeshStandardMaterial({
      color: "#8eb6d8",
      roughness: 0.18,
      metalness: 0.45,
      flatShading: true,
    });
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.set(0, 0.2, 0);
    scene.add(orb);

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.8, 64),
      new THREE.MeshStandardMaterial({ color: "#0a1524", transparent: true, opacity: 0.55 }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -1.55;
    scene.add(disc);

    const sparkCount = 80;
    const sparkPos = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = (Math.random() - 0.5) * 14;
      sparkPos[i * 3 + 1] = Math.random() * 8 - 2;
      sparkPos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2;
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    const sparks = new THREE.Points(
      sparkGeo,
      new THREE.PointsMaterial({
        color: "#9fd7ff",
        size: 0.06,
        transparent: true,
        opacity: 0.85,
      }),
    );
    scene.add(sparks);

    let baseScale = 1;
    let raf = 0;
    let last = performance.now();
    let floatT = 0;

    const colorFor = (s: string) => {
      if (s === "speaking") return new THREE.Color("#3ecfb2");
      if (s === "listening") return new THREE.Color("#f0b429");
      if (s === "thinking") return new THREE.Color("#7aa7ff");
      return new THREE.Color("#8eb6d8");
    };

    const animate = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      floatT += dt;

      const { sessionState, amplitude } = liveRef.current;
      orbMat.color.lerp(colorFor(sessionState), 1 - Math.exp(-dt * 4));

      const target =
        sessionState === "speaking"
          ? 1 + amplitude * 1.8
          : sessionState === "listening"
            ? 1.08
            : 1;
      baseScale += (target - baseScale) * (1 - Math.exp(-dt * 6));
      orb.scale.setScalar(baseScale);

      const spin = sessionState === "speaking" ? 0.55 : 0.12;
      orb.rotation.y += dt * spin;
      orb.rotation.x = Math.sin(now / 1400) * 0.08;
      orb.position.y = 0.2 + Math.sin(floatT * 1.4) * 0.08;
      sparks.rotation.y += dt * 0.05;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    const onResize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      orbGeo.dispose();
      orbMat.dispose();
      sparkGeo.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />;
}

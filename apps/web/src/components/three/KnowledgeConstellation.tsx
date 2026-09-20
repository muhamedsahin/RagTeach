"use client";

import React, { useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useTutorStore, tutorActions } from "@/lib/store";
import { KnowledgeNode } from "@/types/tutor";
import { MOCK_CITATIONS } from "@/services/mockData";

interface SingleNodeProps {
  node: KnowledgeNode;
  isActive: boolean;
  isRetrieved: boolean;
  onSelect: (node: KnowledgeNode) => void;
}

function ConstellationNode({ node, isActive, isRetrieved, onSelect }: SingleNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();

    meshRef.current.rotation.y += 0.015;
    meshRef.current.rotation.x += 0.008;

    const baseScale = isActive ? 1.4 : isRetrieved ? 1.2 : hovered ? 1.25 : 1.0;
    const pulse = isActive ? Math.sin(time * 1.5) * 0.05 : 0;
    meshRef.current.scale.setScalar(baseScale + pulse);

    if (haloRef.current) {
      haloRef.current.rotation.z -= 0.02;
      haloRef.current.scale.setScalar((baseScale + pulse) * 1.6);
    }
  });

  const nodeColor = isActive
    ? "#93c5fd"
    : isRetrieved
    ? "#99f6e4"
    : hovered
    ? "#bae6fd"
    : "#64748b";

  return (
    <group position={node.position}>
      {/* Halo ring for active/retrieved nodes */}
      {(isActive || isRetrieved || hovered) && (
        <mesh ref={haloRef}>
          <ringGeometry args={[0.22, 0.24, 32]} />
          <meshBasicMaterial
            color={nodeColor}
            transparent
            opacity={isActive ? 0.3 : 0.15}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Core Node Geometry */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <octahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial
          color={nodeColor}
          emissive={nodeColor}
          emissiveIntensity={isActive ? 0.4 : hovered ? 0.3 : 0.1}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* 3D Floating HTML Label */}
      <Html
        position={[0, 0.32, 0]}
        center
        distanceFactor={8}
        style={{
          pointerEvents: "none",
          transition: "all 0.25s ease",
          opacity: isActive || isRetrieved || hovered ? 1 : 0.65,
        }}
      >
        <div
          className={`flex flex-col items-center whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] tracking-wider font-mono uppercase transition-all backdrop-blur-md ${
            isActive
              ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.15)]"
              : isRetrieved
              ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
              : "bg-slate-900/60 text-slate-400 border border-white/5"
          }`}
        >
          <span className="font-semibold">{node.label}</span>
          <span className="text-[8px] opacity-75">
            P.{node.page} · {node.category}
          </span>
        </div>
      </Html>
    </group>
  );
}

/**
 * Animated laser beam and packet particles traveling from retrieved node into the core (0,0,0)
 */
function RetrievalBeam({ fromPosition }: { fromPosition: [number, number, number] }) {
  const packetRef = useRef<THREE.Mesh>(null);
  const packet2Ref = useRef<THREE.Mesh>(null);

  const curve = useMemo(() => {
    const start = new THREE.Vector3(...fromPosition);
    const mid = new THREE.Vector3(fromPosition[0] * 0.5, fromPosition[1] * 0.5 + 0.3, fromPosition[2] * 0.5);
    const end = new THREE.Vector3(0, 0, 0);
    return new THREE.QuadraticBezierCurve3(start, mid, end);
  }, [fromPosition]);

  const points = useMemo(() => curve.getPoints(36), [curve]);
  const lineObject = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: "#38bdf8",
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Line(geo, mat);
  }, [points]);

  useFrame((state) => {
    const t = (state.clock.getElapsedTime() * 0.8) % 1;
    const t2 = (t + 0.5) % 1;

    if (packetRef.current) {
      const pos = curve.getPoint(t);
      packetRef.current.position.copy(pos);
    }
    if (packet2Ref.current) {
      const pos2 = curve.getPoint(t2);
      packet2Ref.current.position.copy(pos2);
    }
  });

  return (
    <group>
      {/* Ambient static guide line */}
      <primitive object={lineObject} />

      {/* Flowing energy packets */}
      <mesh ref={packetRef}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.6} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={packet2Ref}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.6} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

export function KnowledgeConstellation() {
  const knowledgeNodes = useTutorStore((s) => s.knowledgeNodes);
  const activeNodeId = useTutorStore((s) => s.activeNodeId);
  const tutorState = useTutorStore((s) => s.tutorState);

  const handleNodeSelect = (node: KnowledgeNode) => {
    tutorActions.setActiveNode(node.id);
    const foundCitation = MOCK_CITATIONS.find((c) => c.nodeId === node.id || c.pageNumber === node.page);
    if (foundCitation) {
      tutorActions.setActiveCitation(foundCitation);
      tutorActions.toggleSourceInspector(true);
    }
  };

  const activeNode = useMemo(
    () => knowledgeNodes.find((n) => n.id === activeNodeId),
    [knowledgeNodes, activeNodeId]
  );

  return (
    <group>
      {/* Knowledge Nodes */}
      {knowledgeNodes.map((node) => (
        <ConstellationNode
          key={node.id}
          node={node}
          isActive={node.id === activeNodeId}
          isRetrieved={node.status === "retrieved"}
          onSelect={handleNodeSelect}
        />
      ))}

      {/* Laser retrieval beam from active node into central AI core */}
      {activeNode && (tutorState === "retrieving" || tutorState === "teaching" || tutorState === "speaking") && (
        <RetrievalBeam fromPosition={activeNode.position} />
      )}
    </group>
  );
}

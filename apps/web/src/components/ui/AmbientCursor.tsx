"use client";

import React, { useEffect, useRef } from "react";
import { useTutorStore } from "@/lib/store";

export function AmbientCursor() {
  const quality = useTutorStore((s) => s.quality);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  // Use refs for mouse coordinates to completely eliminate React re-renders
  const mouseX = useRef(-100);
  const mouseY = useRef(-100);
  const ringX = useRef(-100);
  const ringY = useRef(-100);
  const isHovered = useRef(false);
  const isVisible = useRef(false);

  useEffect(() => {
    // Only enable on fine pointer devices (desktops/laptops)
    if (typeof window === "undefined" || window.matchMedia("(pointer: coarse)").matches) {
      return;
    }

    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX.current = e.clientX;
      mouseY.current = e.clientY;

      if (!isVisible.current) {
        isVisible.current = true;
        ringX.current = e.clientX;
        ringY.current = e.clientY;
        if (dotRef.current) dotRef.current.style.opacity = "1";
        if (ringRef.current) ringRef.current.style.opacity = "1";
      }

      // Check for clickable elements with fast elementFromPoint or target check
      const target = e.target as HTMLElement | null;
      if (target) {
        isHovered.current = !!target.closest('button, a, input, select, [role="button"], label');
      }
    };

    const handleMouseLeave = () => {
      isVisible.current = false;
      if (dotRef.current) dotRef.current.style.opacity = "0";
      if (ringRef.current) ringRef.current.style.opacity = "0";
    };

    const handleMouseEnter = () => {
      isVisible.current = true;
      if (dotRef.current) dotRef.current.style.opacity = "1";
      if (ringRef.current) ringRef.current.style.opacity = "1";
    };

    // 144Hz smooth RAF loop without any React re-renders
    const render = () => {
      if (isVisible.current) {
        // Dot moves with zero delay (instantaneous tracking)
        if (dotRef.current) {
          dotRef.current.style.transform = `translate3d(${mouseX.current}px, ${mouseY.current}px, 0)`;
        }

        // Ring smoothly trails with fluid damping
        const lerpFactor = 0.22;
        ringX.current += (mouseX.current - ringX.current) * lerpFactor;
        ringY.current += (mouseY.current - ringY.current) * lerpFactor;

        if (ringRef.current) {
          const size = isHovered.current ? 38 : 26;
          const offset = size / 2;
          ringRef.current.style.width = `${size}px`;
          ringRef.current.style.height = `${size}px`;
          ringRef.current.style.borderColor = isHovered.current
            ? "rgba(34, 211, 238, 0.6)"
            : "rgba(34, 211, 238, 0.25)";
          ringRef.current.style.transform = `translate3d(${ringX.current - offset}px, ${
            ringY.current - offset
          }px, 0)`;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // In low quality mode, disable custom cursor completely for maximum GPU performance
  if (quality === "low") return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden select-none">
      {/* Soft Trailing Glow Ring */}
      <div
        ref={ringRef}
        style={{
          opacity: 0,
          willChange: "transform, width, height",
          transition: "opacity 0.2s ease, width 0.15s ease, height 0.15s ease, border-color 0.15s ease",
        }}
        className="absolute top-0 left-0 rounded-full border border-cyan-400/25 bg-cyan-400/5 backdrop-blur-[1px]"
      />

      {/* Instant Central Micro Dot */}
      <div
        ref={dotRef}
        style={{
          opacity: 0,
          willChange: "transform",
          transition: "opacity 0.15s ease",
          marginTop: "-3px",
          marginLeft: "-3px",
        }}
        className="absolute top-0 left-0 w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"
      />
    </div>
  );
}

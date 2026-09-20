"use client";

import { useEffect, useState } from "react";
import { audioService } from "@/services/audioService";
import { AudioFrequencyData } from "@/types/tutor";
import { tutorActions } from "./store";

export function useAudioReactive() {
  const [metrics, setMetrics] = useState<AudioFrequencyData>(audioService.getMetrics());

  useEffect(() => {
    const unsubscribe = audioService.subscribe((newMetrics) => {
      setMetrics(newMetrics);
      tutorActions.setAudioMetrics(newMetrics);
    });

    return () => unsubscribe();
  }, []);

  return metrics;
}


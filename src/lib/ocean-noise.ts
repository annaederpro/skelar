"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Synthesizes a soft ocean-wave-like noise (filtered white noise with a
 * slow gain swell) entirely client-side via the Web Audio API — no audio
 * asset to source, license, or host.
 */
export function useOceanNoise() {
  const [isPlaying, setIsPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const wantsPlayingRef = useRef(false);

  const stop = () => {
    wantsPlayingRef.current = false;
    sourceRef.current?.stop();
    sourceRef.current?.disconnect();
    lfoRef.current?.stop();
    lfoRef.current?.disconnect();
    gainRef.current?.disconnect();
    sourceRef.current = null;
    lfoRef.current = null;
    gainRef.current = null;
    setIsPlaying(false);
  };

  const start = async () => {
    wantsPlayingRef.current = true;
    const ctx = ctxRef.current ?? new AudioContext();
    ctxRef.current = ctx;
    setIsPlaying(true);

    // Mobile/iOS browsers only unlock audio playback when resume() runs
    // synchronously from a user gesture *and* the caller awaits it before
    // starting any node — the previous fire-and-forget resume() left the
    // context suspended and produced no sound on those browsers.
    await ctx.resume();
    if (!wantsPlayingRef.current) return; // toggled off again while resuming

    // 2 seconds of noise, looped — generated once and reused across toggles.
    if (!bufferRef.current) {
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      bufferRef.current = buffer;
    }

    const source = ctx.createBufferSource();
    source.buffer = bufferRef.current;
    source.loop = true;

    // soften harsh white noise into a "shhh" wash
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 650;

    // base gain + slow LFO for a wave-swell feel
    const gain = ctx.createGain();
    gain.gain.value = 0.05;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start();
    lfo.start();

    sourceRef.current = source;
    gainRef.current = gain;
    lfoRef.current = lfo;
  };

  const toggle = () => {
    if (isPlaying) stop();
    else void start();
  };

  useEffect(() => {
    return () => {
      stop();
      void ctxRef.current?.close();
    };
  }, []);

  return { isPlaying, toggle, stop };
}

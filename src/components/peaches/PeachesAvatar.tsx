"use client";

// 3D Peaches, ported from Unfold/Curious Cats (whiskers removed).
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createPeachesScene, preloadPeachesModels } from "./peachesAssets";
import { createPeachesMotion } from "./peachesMotion";
import type { PeachesMood } from "./peachesBehavior";
import { speechLevel } from "@/lib/voice";

const waveFade = 0.3;

export default function PeachesAvatar({ mood = "idle", wave = false, size = 160 }: { mood?: PeachesMood; wave?: boolean; size?: number }) {
  const mount = useRef<HTMLDivElement>(null);
  const live = useRef({ mood, wave });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    live.current = { mood, wave };
  }, [mood, wave]);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let disposed = false;
    let frame = 0;
    let cleanup = () => {};
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    void preloadPeachesModels()
      .then((loaded) => {
        if (disposed) return;
        let renderer: THREE.WebGLRenderer;
        try {
          renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        } catch {
          return;
        }
        const { scene, camera, rest, mixer, action, fit } = createPeachesScene(loaded);
        const movement = createPeachesMotion(rest);
        if (action) {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.7;
        host.appendChild(renderer.domElement);
        const resize = () => {
          const { width, height } = host.getBoundingClientRect();
          if (!width || !height) return;
          fit(width, height);
          renderer.setSize(width, height, false);
        };
        const observer = new ResizeObserver(resize);
        observer.observe(host);
        resize();
        renderer.render(scene, camera);
        setReady(true);
        const clock = new THREE.Clock();
        let elapsed = 0;
        let lastWave = false;
        let waveEnds = 0;
        const finishWave = () => {
          action?.fadeOut(waveFade);
          waveEnds = elapsed + waveFade;
        };
        mixer?.addEventListener("finished", finishWave);
        const render = () => {
          frame = requestAnimationFrame(render);
          const delta = Math.min(clock.getDelta(), 0.05);
          if (document.hidden) return;
          elapsed += delta;
          const shouldWave = live.current.wave && !reduced.matches && Boolean(action);
          if (shouldWave !== lastWave) {
            if (shouldWave) {
              waveEnds = 0;
              action?.reset().fadeIn(waveFade).play();
            } else finishWave();
            lastWave = shouldWave;
          }
          if (reduced.matches) {
            action?.stop();
            waveEnds = 0;
          } else if (waveEnds && elapsed >= waveEnds) {
            action?.stop();
            waveEnds = 0;
          }
          if (!reduced.matches) mixer?.update(delta);
          const activeWave = Boolean(action?.enabled && (action.isRunning() || action.paused));
          const m = live.current.mood;
          movement.update(elapsed, delta, m, m === "speaking" ? speechLevel() : 0, activeWave, reduced.matches, 0);
          renderer.render(scene, camera);
        };
        render();
        cleanup = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          mixer?.removeEventListener("finished", finishWave);
          mixer?.stopAllAction();
          mixer?.uncacheRoot(rest);
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch(() => {});
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div
      ref={mount}
      className={`peaches-avatar shrink-0 ${ready ? "is-ready" : ""}`}
      style={{ width: size, height: size }}
      data-mood={mood}
      role="img"
      aria-label="Peaches, your coach"
    >
      {/* Poster while the model loads (and fallback without WebGL) */}
      <span className="peaches-poster orb" aria-hidden />
    </div>
  );
}

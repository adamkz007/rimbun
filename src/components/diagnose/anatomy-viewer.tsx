"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { CameraControls, useGLTF } from "@react-three/drei";
import { ANATOMY_INDEX } from "@/lib/diagnose/anatomy-index";
import type { ReferredAreaId, RegionId, Side, SpinalLevel, StructureKey, Vec3 } from "@/lib/diagnose/anatomy";
import { REFERRED_AREAS } from "@/lib/diagnose/anatomy";
import type { ViewTarget } from "@/lib/diagnose/view";
import { AtlasModel } from "./atlas-model";
import { BodyShell } from "./body-shell";
import { PainPathway, type PathwayStage } from "./pain-pathway";

ANATOMY_INDEX.atlases.forEach((atlas) => useGLTF.preload(atlas.url));

export type ExplainProps = {
  origin: Vec3;
  spinalLevel: SpinalLevel;
  referred: ReferredAreaId[];
  stage: PathwayStage;
};

export type AnatomyViewerProps = {
  view: ViewTarget;
  region: RegionId | null;
  side: Side | null;
  highlight: StructureKey[];
  marker?: Vec3 | null;
  explain?: ExplainProps | null;
  interactive?: boolean;
  onPickRegion?: (region: RegionId, side: Side | null) => void;
};

function CameraRig({ view, reducedMotion }: { view: ViewTarget; reducedMotion: boolean }) {
  const controls = useRef<CameraControls>(null);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const dir = new THREE.Vector3(...view.direction).normalize().multiplyScalar(view.distance);
    const [tx, ty, tz] = view.target;
    void c.setLookAt(tx + dir.x, ty + dir.y, tz + dir.z, tx, ty, tz, !reducedMotion);
  }, [view, reducedMotion]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={0.2}
      maxDistance={5}
      smoothTime={0.6}
      dollySpeed={0.6}
    />
  );
}

function Marker({ point }: { point: Vec3 }) {
  return (
    <mesh position={point} renderOrder={40}>
      <sphereGeometry args={[0.012, 16, 12]} />
      <meshBasicMaterial color="#ff5a3c" depthTest={false} transparent opacity={0.95} />
    </mesh>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function AnatomyViewer({
  view,
  region,
  side,
  highlight,
  marker,
  explain,
  interactive = false,
  onPickRegion,
}: AnatomyViewerProps) {
  const reducedMotion = usePrefersReducedMotion();
  // Rendered client-side only (next/dynamic with ssr: false).
  const [webgl] = useState(hasWebGL);

  const highlightSet = useMemo(() => new Set<string>(highlight), [highlight]);
  const emptySet = useMemo(() => new Set<string>(), []);
  const dimOthers = highlight.length > 0;

  // Knee atlas is a left knee; the mirrored copy is the right knee.
  const kneeFor = (instanceSide: "left" | "right") =>
    !side || side === "both" || side === instanceSide ? highlightSet : emptySet;

  const referred = useMemo(
    () => (explain?.referred ?? []).map((id) => REFERRED_AREAS[id]).map((r) => ({ label: r.label, point: r.point as Vec3 })),
    [explain?.referred]
  );

  if (!webgl) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/70">
        3D view isn&apos;t available on this device. You can still answer every question using the buttons.
      </div>
    );
  }

  return (
    <Canvas
      camera={{ position: [0.5, 1.3, 3.6], fov: 32, near: 0.01, far: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => {
        document.body.style.cursor = "";
      }}
    >
      <ambientLight intensity={0.75} />
      <hemisphereLight args={["#fff8ef", "#0b3b39", 0.6]} />
      <directionalLight position={[2, 3, 3]} intensity={1.6} />
      <directionalLight position={[-2, 1.5, -2]} intensity={0.6} />

      <Suspense fallback={null}>
        {ANATOMY_INDEX.atlases.map((atlas) =>
          atlas.mirror ? (
            <group key={atlas.id}>
              <AtlasModel url={atlas.url} highlight={kneeFor("left")} dimOthers={dimOthers} />
              <AtlasModel url={atlas.url} mirrorX highlight={kneeFor("right")} dimOthers={dimOthers} />
            </group>
          ) : (
            <AtlasModel key={atlas.id} url={atlas.url} highlight={highlightSet} dimOthers={dimOthers} />
          )
        )}
      </Suspense>

      <BodyShell activeRegion={region} activeSide={side} interactive={interactive} onPick={onPickRegion} />

      {marker && !explain ? <Marker point={marker} /> : null}

      {explain ? (
        <PainPathway
          origin={explain.origin}
          spinalLevel={explain.spinalLevel}
          referred={referred}
          stage={explain.stage}
          reducedMotion={reducedMotion}
        />
      ) : null}

      <CameraRig view={view} reducedMotion={reducedMotion} />
    </Canvas>
  );
}

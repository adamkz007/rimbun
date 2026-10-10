"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import { BRAIN_PATH, SPINAL_ENTRY, type SpinalLevel, type Vec3 } from "@/lib/diagnose/anatomy";

const NERVE = "#ffd166";
const REFERRED = "#c084fc";
const PARTICLES = 6;

export type PathwayStage = 0 | 1 | 2 | 3;

function Label({ point, index, text, active }: { point: Vec3; index: number; text: string; active: boolean }) {
  return (
    <Html position={point} center zIndexRange={[20, 0]}>
      <div
        className={`pointer-events-none flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium shadow-sm transition-opacity ${
          active ? "border-[#ffd166] bg-[#083a39]/90 text-white opacity-100" : "border-white/20 bg-[#083a39]/70 text-white/70 opacity-70"
        }`}
      >
        <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#ffd166] text-[10px] text-[#083a39]">
          {index}
        </span>
        {text}
      </div>
    </Html>
  );
}

function Pulse({ point, color, scale = 0.018 }: { point: Vec3; color: string; scale?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = scale * (1 + 0.45 * Math.sin(clock.elapsedTime * 4));
    ref.current.scale.setScalar(s);
  });
  return (
    <mesh ref={ref} position={point}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} depthTest={false} />
    </mesh>
  );
}

function Signal({ curve, color, speed, reducedMotion }: { curve: THREE.Curve<THREE.Vector3>; color: string; speed: number; reducedMotion: boolean }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const t = reducedMotion ? i / PARTICLES : (clock.elapsedTime * speed + i / PARTICLES) % 1;
      mesh.position.copy(curve.getPointAt(t));
    });
  });
  return (
    <>
      {Array.from({ length: PARTICLES }, (_, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m; }} renderOrder={30}>
          <sphereGeometry args={[0.006, 10, 8]} />
          <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
        </mesh>
      ))}
    </>
  );
}

/**
 * The ascending pain pathway: receptors at the origin -> spinal nerve ->
 * spinal cord -> brainstem -> thalamus -> sensory cortex, plus optional
 * referred-pain areas that share the same spinal segment.
 */
export function PainPathway({
  origin,
  spinalLevel,
  referred,
  stage,
  reducedMotion,
}: {
  origin: Vec3;
  spinalLevel: SpinalLevel;
  referred: { label: string; point: Vec3 }[];
  stage: PathwayStage;
  reducedMotion: boolean;
}) {
  const entry = SPINAL_ENTRY[spinalLevel];

  const curve = useMemo(() => {
    const pts: Vec3[] = [origin];
    if (spinalLevel !== "cranial") {
      // Peripheral nerve wraps back to the spine at the same height.
      pts.push([origin[0] * 0.5, (origin[1] + entry[1]) / 2, Math.min(origin[2], entry[2]) - 0.01]);
      pts.push(entry);
      // Ascend the cord.
      const cordTop: Vec3 = [0, 1.5, -0.04];
      if (entry[1] < cordTop[1]) pts.push(cordTop);
    } else {
      pts.push(entry);
    }
    BRAIN_PATH.forEach((p) => pts.push(p.point));
    const vectors = pts.map((p) => new THREE.Vector3(...p));
    return new THREE.CatmullRomCurve3(vectors, false, "centripetal");
  }, [origin, entry, spinalLevel]);

  const linePoints = useMemo(() => curve.getSpacedPoints(120), [curve]);

  const referredCurves = useMemo(
    () =>
      referred.map((r) =>
        new THREE.CatmullRomCurve3(
          [new THREE.Vector3(...entry), new THREE.Vector3((entry[0] + r.point[0]) / 2, (entry[1] + r.point[1]) / 2, entry[2]), new THREE.Vector3(...r.point)],
          false,
          "centripetal"
        )
      ),
    [referred, entry]
  );

  const brain = BRAIN_PATH;

  return (
    <group>
      <Line points={linePoints} color={NERVE} lineWidth={2.2} transparent opacity={0.85} depthTest={false} renderOrder={25} />
      <Signal curve={curve} color={NERVE} speed={0.22} reducedMotion={reducedMotion} />
      <Pulse point={origin} color="#ff5a3c" scale={0.022} />

      {referredCurves.map((c, i) => (
        <group key={referred[i].label}>
          <Line points={c.getSpacedPoints(40)} color={REFERRED} lineWidth={1.5} dashed dashSize={0.02} gapSize={0.012} depthTest={false} renderOrder={25} />
          <Pulse point={referred[i].point} color={REFERRED} scale={0.03} />
          <Label point={referred[i].point} index={4} text={`Felt here: ${referred[i].label}`} active={stage === 3} />
        </group>
      ))}

      <Label point={origin} index={1} text="Pain receptors fire" active={stage === 0} />
      <Label point={[entry[0] + 0.06, entry[1], entry[2]]} index={2} text="Spinal cord" active={stage === 1} />
      <Label point={brain[1].point} index={3} text={brain[1].label} active={stage === 2} />
      <Label point={[brain[2].point[0], brain[2].point[1] + 0.03, brain[2].point[2]]} index={3} text={brain[2].label} active={stage === 2} />
    </group>
  );
}

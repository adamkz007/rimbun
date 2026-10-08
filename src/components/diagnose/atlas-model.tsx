"use client";

/* eslint-disable react-hooks/immutability -- Three.js materials are mutated imperatively each frame by design. */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

// Structures drawn see-through by default so the organs behind stay visible.
const BASE_OPACITY: Record<string, number> = {
  head_skin: 0.1,
  abdominal_wall: 0.16,
  back_muscles: 0.3,
  gluteal_muscles: 0.25,
  thigh_muscles: 0.28,
  calf_muscles: 0.3,
  jaw_muscles: 0.35,
  ribs: 0.8,
  right_lung: 0.45,
  left_lung: 0.45,
  shoulder_girdle: 0.85,
};

const HIGHLIGHT = new THREE.Color("#ff5a3c");

type MeshState = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  baseOpacity: number;
  key: string;
};

export function AtlasModel({
  url,
  mirrorX = false,
  highlight,
  dimOthers,
  visible = true,
}: {
  url: string;
  mirrorX?: boolean;
  highlight: Set<string>;
  dimOthers: boolean;
  visible?: boolean;
}) {
  const { scene } = useGLTF(url);

  const { root, meshes } = useMemo(() => {
    const clone = scene.clone(true);
    const list: MeshState[] = [];
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const key = object.parent && object.parent !== clone ? object.parent.name || object.name : object.name;
      const source = object.material as THREE.MeshStandardMaterial;
      const material = source.clone();
      const baseOpacity = BASE_OPACITY[key] ?? 1;
      material.transparent = true;
      material.opacity = baseOpacity;
      material.depthWrite = baseOpacity > 0.6;
      material.side = THREE.DoubleSide;
      object.material = material;
      object.raycast = () => null; // the body shell owns pointer events
      list.push({ mesh: object, material, baseOpacity, key });
    });
    return { root: clone, meshes: list };
  }, [scene]);

  useEffect(() => {
    return () => meshes.forEach((m) => m.material.dispose());
  }, [meshes]);

  const highlightRef = useRef(highlight);

  useEffect(() => {
    highlightRef.current = highlight;
    for (const m of meshes) {
      const lit = highlight.has(m.key);
      const opacity = lit ? Math.max(m.baseOpacity, 0.9) : dimOthers ? m.baseOpacity * 0.22 : m.baseOpacity;
      m.material.opacity = opacity;
      m.material.depthWrite = opacity > 0.6;
      m.mesh.renderOrder = lit ? 5 : 0;
      if (!lit) {
        m.material.emissive.setRGB(0, 0, 0);
        m.material.emissiveIntensity = 0;
      }
    }
  }, [meshes, highlight, dimOthers]);

  useFrame(({ clock }) => {
    const pulse = 0.15 + 0.3 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 3));
    for (const m of meshes) {
      if (!highlightRef.current.has(m.key)) continue;
      m.material.emissive.copy(HIGHLIGHT);
      m.material.emissiveIntensity = pulse;
    }
  });

  return <primitive object={root} scale={mirrorX ? [-1, 1, 1] : [1, 1, 1]} visible={visible} />;
}

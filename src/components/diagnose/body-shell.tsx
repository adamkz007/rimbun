"use client";

import { useMemo, useState } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { BODY_SHELL, type RegionId, type ShellPart, type Side } from "@/lib/diagnose/anatomy";

const BASE_COLOR = new THREE.Color("#9fe3d6");
const ACTIVE_COLOR = new THREE.Color("#ff8a65");

function capsuleTransform(part: ShellPart) {
  const a = new THREE.Vector3(...part.a);
  const b = new THREE.Vector3(...(part.b ?? part.a));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a);
  const length = dir.length();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize()
  );
  return { position: mid, quaternion, length };
}

function ShellMesh({
  part,
  active,
  interactive,
  onPick,
}: {
  part: ShellPart;
  active: boolean;
  interactive: boolean;
  onPick?: (region: RegionId, side: Side | null) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const geometry = useMemo(() => {
    if (part.shape === "capsule") {
      const { length } = capsuleTransform(part);
      return new THREE.CapsuleGeometry(part.radii[0], length, 6, 16);
    }
    return new THREE.SphereGeometry(1, 28, 20);
  }, [part]);

  const transform = useMemo(() => {
    if (part.shape === "capsule") {
      const { position, quaternion } = capsuleTransform(part);
      return { position, quaternion, scale: new THREE.Vector3(1, 1, 1) };
    }
    return {
      position: new THREE.Vector3(...part.a),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(...part.radii),
    };
  }, [part]);

  const opacity = active ? 0.3 : hovered && interactive ? 0.22 : 0.09;

  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (!interactive || !onPick) return;
    event.stopPropagation();
    let region = part.region;
    // Clicks on the back half of the trunk mean "back".
    if ((region === "chest" || region === "abdomen") && event.point.z < -0.03) {
      region = "back";
    }
    onPick(region, part.side ?? null);
  }

  return (
    <mesh
      geometry={geometry}
      position={transform.position}
      quaternion={transform.quaternion}
      scale={transform.scale}
      renderOrder={10}
      onClick={handleClick}
      onPointerOver={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "";
      }}
    >
      <meshStandardMaterial
        color={active ? ACTIVE_COLOR : BASE_COLOR}
        transparent
        opacity={opacity}
        depthWrite={false}
        roughness={0.4}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

export function BodyShell({
  activeRegion,
  activeSide,
  interactive,
  onPick,
}: {
  activeRegion: RegionId | null;
  activeSide: Side | null;
  interactive: boolean;
  onPick?: (region: RegionId, side: Side | null) => void;
}) {
  return (
    <group>
      {BODY_SHELL.map((part, index) => {
        const regionMatch =
          activeRegion === part.region ||
          (activeRegion === "back" && (part.region === "chest" || part.region === "abdomen"));
        const sideMatch = !part.side || !activeSide || activeSide === "both" || activeSide === part.side;
        return (
          <ShellMesh
            key={`${part.region}-${part.side ?? "c"}-${index}`}
            part={part}
            active={regionMatch && sideMatch}
            interactive={interactive}
            onPick={onPick}
          />
        );
      })}
    </group>
  );
}

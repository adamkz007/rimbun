"use client";

import { useRef, useState } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import { outcomeAnimations, type OutcomeAnimationKey } from "./outcome-lottie-data";

export function OutcomeLottie({
  animation,
  className,
}: {
  animation: OutcomeAnimationKey;
  className?: string;
}) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={className}
      onMouseEnter={() => {
        setHovered(true);
        lottieRef.current?.setSpeed(1);
      }}
      onMouseLeave={() => {
        setHovered(false);
        lottieRef.current?.setSpeed(0.6);
      }}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={outcomeAnimations[animation]}
        loop
        autoplay
        initialSegment={undefined}
        style={{ width: "100%", height: "100%" }}
        rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
        onDOMLoaded={() => {
          if (!hovered) {
            lottieRef.current?.setSpeed(0.6);
          }
        }}
      />
    </div>
  );
}

import { cn } from "@/lib/utils";

type RimbunVariant = "color" | "reversed" | "mono";

const TONES: Record<RimbunVariant, { dark: string; light: string }> = {
  color: { dark: "#12382A", light: "#2E7D55" },
  reversed: { dark: "#F7F8F5", light: "#9BCBA6" },
  mono: { dark: "currentColor", light: "currentColor" },
};

const MAIN_LEAF_ANGLES = [0, 90, 180, 270];
const SMALL_LEAF_ANGLES = [45, 135, 225, 315];

type RimbunMarkProps = React.ComponentProps<"svg"> & {
  variant?: RimbunVariant;
};

export function RimbunMark({
  variant = "color",
  className,
  ...props
}: RimbunMarkProps) {
  const { dark, light } = TONES[variant];

  return (
    <svg
      viewBox="10 10 180 180"
      aria-hidden="true"
      focusable="false"
      className={cn("size-8 shrink-0", className)}
      {...props}
    >
      {SMALL_LEAF_ANGLES.map((angle) => (
        <g key={angle} transform={`rotate(${angle} 100 100)`}>
          <path d="M100 86C89 74 89 54 100 40Z" fill={dark} />
          <path d="M100 86C111 74 111 54 100 40Z" fill={light} />
        </g>
      ))}
      {MAIN_LEAF_ANGLES.map((angle) => (
        <g key={angle} transform={`rotate(${angle} 100 100)`}>
          <path d="M100 90C76 72 76 40 100 14Z" fill={dark} />
          <path d="M100 90C124 72 124 40 100 14Z" fill={light} />
        </g>
      ))}
    </svg>
  );
}

type RimbunLogoProps = React.ComponentProps<"span"> & {
  variant?: RimbunVariant;
  markClassName?: string;
};

export function RimbunLogo({
  variant = "color",
  className,
  markClassName,
  ...props
}: RimbunLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-brand font-extrabold leading-none tracking-[-0.035em]",
        variant === "color" && "text-[#12382A]",
        variant === "reversed" && "text-[#F7F8F5]",
        className
      )}
      {...props}
    >
      <RimbunMark variant={variant} className={cn("size-[1.15em]", markClassName)} />
      <span>rimbun</span>
    </span>
  );
}

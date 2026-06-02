type LottieValue = number | number[];

function hexToRgba(hex: string, alpha = 1) {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  const int = parseInt(value, 16);
  return [
    ((int >> 16) & 255) / 255,
    ((int >> 8) & 255) / 255,
    (int & 255) / 255,
    alpha,
  ];
}

function keyframe<T extends LottieValue>(t: number, s: T, e?: T) {
  if (e === undefined) {
    return { t, s: Array.isArray(s) ? s : [s] };
  }

  return {
    t,
    s: Array.isArray(s) ? s : [s],
    e: Array.isArray(e) ? e : [e],
    i: { x: [0.4], y: [1] },
    o: { x: [0.6], y: [0] },
  };
}

function easeOutKeyframe<T extends LottieValue>(t: number, s: T, e?: T) {
  if (e === undefined) {
    return { t, s: Array.isArray(s) ? s : [s] };
  }

  return {
    t,
    s: Array.isArray(s) ? s : [s],
    e: Array.isArray(e) ? e : [e],
    i: { x: [0.2], y: [1] },
    o: { x: [0.8], y: [0] },
  };
}

function springKeyframe<T extends LottieValue>(t: number, s: T, e?: T) {
  if (e === undefined) {
    return { t, s: Array.isArray(s) ? s : [s] };
  }

  return {
    t,
    s: Array.isArray(s) ? s : [s],
    e: Array.isArray(e) ? e : [e],
    i: { x: [0.175], y: [0.885] },
    o: { x: [0.32], y: [1] },
  };
}

function animatedProp<T extends LottieValue>(frames: Array<ReturnType<typeof keyframe<T>>>) {
  return { a: 1, k: frames };
}

function staticProp<T extends LottieValue>(value: T) {
  return { a: 0, k: value };
}

function roundedRect({
  width,
  height,
  radius,
  fill,
  stroke,
  strokeWidth,
  opacity,
}: {
  width: number;
  height: number;
  radius: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}) {
  const items: Array<Record<string, unknown>> = [
    {
      ty: "rc",
      d: 1,
      s: staticProp([width, height]),
      p: staticProp([0, 0]),
      r: staticProp(radius),
      nm: "Rect Path",
    },
    {
      ty: "fl",
      c: staticProp(hexToRgba(fill)),
      o: staticProp(opacity ?? 100),
      r: 1,
      bm: 0,
      nm: "Fill",
    },
  ];

  if (stroke) {
    items.push({
      ty: "st",
      c: staticProp(hexToRgba(stroke)),
      o: staticProp(100),
      w: staticProp(strokeWidth ?? 1.5),
      lc: 2,
      lj: 2,
      ml: 4,
      bm: 0,
      nm: "Stroke",
    });
  }

  items.push({
    ty: "tr",
    p: staticProp([0, 0]),
    a: staticProp([0, 0]),
    s: staticProp([100, 100]),
    r: staticProp(0),
    o: staticProp(100),
    sk: staticProp(0),
    sa: staticProp(0),
    nm: "Transform",
  });

  return {
    ty: "gr",
    it: items,
    nm: "Rect Group",
    np: items.length - 1,
    cix: 2,
    bm: 0,
  };
}

function ellipse({
  width,
  height,
  fill,
  stroke,
  strokeWidth,
  opacity,
}: {
  width: number;
  height: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}) {
  const items: Array<Record<string, unknown>> = [
    {
      ty: "el",
      p: staticProp([0, 0]),
      s: staticProp([width, height]),
      d: 1,
      nm: "Ellipse Path",
    },
    {
      ty: "fl",
      c: staticProp(hexToRgba(fill)),
      o: staticProp(opacity ?? 100),
      r: 1,
      bm: 0,
      nm: "Fill",
    },
  ];

  if (stroke) {
    items.push({
      ty: "st",
      c: staticProp(hexToRgba(stroke)),
      o: staticProp(100),
      w: staticProp(strokeWidth ?? 1.5),
      lc: 2,
      lj: 2,
      ml: 4,
      bm: 0,
      nm: "Stroke",
    });
  }

  items.push({
    ty: "tr",
    p: staticProp([0, 0]),
    a: staticProp([0, 0]),
    s: staticProp([100, 100]),
    r: staticProp(0),
    o: staticProp(100),
    sk: staticProp(0),
    sa: staticProp(0),
    nm: "Transform",
  });

  return {
    ty: "gr",
    it: items,
    nm: "Ellipse Group",
    np: items.length - 1,
    cix: 2,
    bm: 0,
  };
}

function makeShapeLayer({
  ind,
  name,
  x,
  y,
  width,
  height,
  radius,
  fill,
  stroke,
  strokeWidth,
  fillOpacity,
  positionFrames,
  scaleFrames,
  opacityFrames,
  rotationFrames,
  ellipseShape = false,
  startFrame = 0,
}: {
  ind: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  positionFrames?: Array<ReturnType<typeof keyframe<number[]>>>;
  scaleFrames?: Array<ReturnType<typeof keyframe<number[]>>>;
  opacityFrames?: Array<ReturnType<typeof keyframe<number>>>;
  rotationFrames?: Array<ReturnType<typeof keyframe<number>>>;
  ellipseShape?: boolean;
  startFrame?: number;
}) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm: name,
    sr: 1,
    ks: {
      o: opacityFrames ? animatedProp(opacityFrames) : staticProp(100),
      r: rotationFrames ? animatedProp(rotationFrames) : staticProp(0),
      p: positionFrames ? animatedProp(positionFrames) : staticProp([x, y, 0]),
      a: staticProp([0, 0, 0]),
      s: scaleFrames ? animatedProp(scaleFrames) : staticProp([100, 100, 100]),
    },
    ao: 0,
    shapes: [
      ellipseShape
        ? ellipse({ width, height, fill, stroke, strokeWidth, opacity: fillOpacity })
        : roundedRect({ width, height, radius: radius ?? 12, fill, stroke, strokeWidth, opacity: fillOpacity }),
    ],
    ip: startFrame,
    op: 180,
    st: startFrame,
    bm: 0,
  };
}

function baseAnimation(name: string, layers: Array<Record<string, unknown>>) {
  return {
    v: "5.9.6",
    fr: 60,
    ip: 0,
    op: 180,
    w: 200,
    h: 140,
    nm: name,
    ddd: 0,
    assets: [],
    layers,
  };
}

// "Less clicking during consults" — A streamlined interface consolidating into one action
function buildFlowAnimation() {
  return baseAnimation("Outcome Flow", [
    // Background card (workspace)
    makeShapeLayer({
      ind: 1,
      name: "Workspace",
      x: 100,
      y: 70,
      width: 148,
      height: 100,
      radius: 20,
      fill: "#F8F4EF",
      stroke: "#E8DFD4",
    }),
    // Top bar
    makeShapeLayer({
      ind: 2,
      name: "Top Bar",
      x: 100,
      y: 34,
      width: 120,
      height: 8,
      radius: 4,
      fill: "#E8DFD4",
      opacityFrames: [
        keyframe(0, 60, 80),
        keyframe(90, 80, 60),
        keyframe(180, 60),
      ],
    }),
    // Row 1 - slides in from left, then fades to checkmark
    makeShapeLayer({
      ind: 3,
      name: "Row 1",
      x: 78,
      y: 52,
      width: 86,
      height: 14,
      radius: 7,
      fill: "#FFFFFF",
      stroke: "#E2DAD0",
      positionFrames: [
        springKeyframe(0, [60, 52, 0], [78, 52, 0]),
        keyframe(30, [78, 52, 0], [78, 52, 0]),
        keyframe(180, [78, 52, 0]),
      ],
      opacityFrames: [
        keyframe(0, 0, 100),
        keyframe(20, 100, 100),
        keyframe(180, 100),
      ],
    }),
    // Row 2 - slides in staggered
    makeShapeLayer({
      ind: 4,
      name: "Row 2",
      x: 84,
      y: 72,
      width: 98,
      height: 14,
      radius: 7,
      fill: "#FFFFFF",
      stroke: "#E2DAD0",
      positionFrames: [
        springKeyframe(12, [60, 72, 0], [84, 72, 0]),
        keyframe(42, [84, 72, 0], [84, 72, 0]),
        keyframe(180, [84, 72, 0]),
      ],
      opacityFrames: [
        keyframe(0, 0, 0),
        keyframe(12, 0, 100),
        keyframe(32, 100, 100),
        keyframe(180, 100),
      ],
    }),
    // Row 3 - slides in staggered
    makeShapeLayer({
      ind: 5,
      name: "Row 3",
      x: 72,
      y: 92,
      width: 74,
      height: 14,
      radius: 7,
      fill: "#FFFFFF",
      stroke: "#E2DAD0",
      positionFrames: [
        springKeyframe(24, [52, 92, 0], [72, 92, 0]),
        keyframe(54, [72, 92, 0], [72, 92, 0]),
        keyframe(180, [72, 92, 0]),
      ],
      opacityFrames: [
        keyframe(0, 0, 0),
        keyframe(24, 0, 100),
        keyframe(44, 100, 100),
        keyframe(180, 100),
      ],
    }),
    // Checkmark dot 1
    makeShapeLayer({
      ind: 6,
      name: "Check 1",
      x: 142,
      y: 52,
      width: 12,
      height: 12,
      fill: "#0F5A53",
      ellipseShape: true,
      scaleFrames: [
        springKeyframe(40, [0, 0, 100], [120, 120, 100]),
        springKeyframe(52, [120, 120, 100], [100, 100, 100]),
        keyframe(180, [100, 100, 100]),
      ],
      opacityFrames: [
        keyframe(0, 0, 0),
        keyframe(40, 0, 100),
        keyframe(52, 100, 100),
        keyframe(180, 100),
      ],
    }),
    // Checkmark dot 2
    makeShapeLayer({
      ind: 7,
      name: "Check 2",
      x: 148,
      y: 72,
      width: 12,
      height: 12,
      fill: "#0F5A53",
      ellipseShape: true,
      scaleFrames: [
        springKeyframe(54, [0, 0, 100], [120, 120, 100]),
        springKeyframe(66, [120, 120, 100], [100, 100, 100]),
        keyframe(180, [100, 100, 100]),
      ],
      opacityFrames: [
        keyframe(0, 0, 0),
        keyframe(54, 0, 100),
        keyframe(66, 100, 100),
        keyframe(180, 100),
      ],
    }),
    // Checkmark dot 3
    makeShapeLayer({
      ind: 8,
      name: "Check 3",
      x: 136,
      y: 92,
      width: 12,
      height: 12,
      fill: "#0F5A53",
      ellipseShape: true,
      scaleFrames: [
        springKeyframe(68, [0, 0, 100], [120, 120, 100]),
        springKeyframe(80, [120, 120, 100], [100, 100, 100]),
        keyframe(180, [100, 100, 100]),
      ],
      opacityFrames: [
        keyframe(0, 0, 0),
        keyframe(68, 0, 100),
        keyframe(80, 100, 100),
        keyframe(180, 100),
      ],
    }),
    // Cursor pill that glides down the rows
    makeShapeLayer({
      ind: 9,
      name: "Cursor",
      x: 160,
      y: 52,
      width: 18,
      height: 8,
      radius: 4,
      fill: "#7B68FF",
      positionFrames: [
        easeOutKeyframe(0, [160, 48, 0], [160, 52, 0]),
        easeOutKeyframe(40, [160, 52, 0], [160, 72, 0]),
        easeOutKeyframe(54, [160, 72, 0], [160, 92, 0]),
        easeOutKeyframe(68, [160, 92, 0], [160, 108, 0]),
        keyframe(90, [160, 108, 0], [160, 108, 0]),
        keyframe(120, [160, 108, 0], [160, 48, 0]),
        keyframe(180, [160, 48, 0]),
      ],
      opacityFrames: [
        keyframe(0, 100, 100),
        keyframe(85, 100, 0),
        keyframe(110, 0, 0),
        keyframe(120, 0, 100),
        keyframe(180, 100),
      ],
    }),
    // Subtle glow ring behind workspace
    makeShapeLayer({
      ind: 10,
      name: "Glow",
      x: 100,
      y: 70,
      width: 160,
      height: 110,
      radius: 24,
      fill: "#0F5A53",
      fillOpacity: 6,
      scaleFrames: [
        keyframe(0, [98, 98, 100], [102, 102, 100]),
        keyframe(90, [102, 102, 100], [98, 98, 100]),
        keyframe(180, [98, 98, 100]),
      ],
    }),
  ]);
}

// "Smoother handoff between team members" — Document passing between two people
function buildHandoffAnimation() {
  return baseAnimation("Outcome Handoff", [
    // Connector line
    makeShapeLayer({
      ind: 1,
      name: "Connector",
      x: 100,
      y: 70,
      width: 70,
      height: 3,
      radius: 1.5,
      fill: "#DAF6F1",
      opacityFrames: [
        keyframe(0, 30, 70),
        keyframe(45, 70, 100),
        keyframe(90, 100, 70),
        keyframe(135, 70, 30),
        keyframe(180, 30),
      ],
    }),
    // Left person - body
    makeShapeLayer({
      ind: 2,
      name: "Left Body",
      x: 52,
      y: 82,
      width: 32,
      height: 24,
      radius: 12,
      fill: "#FFFFFF",
      stroke: "#DDD4CA",
    }),
    // Left person - head
    makeShapeLayer({
      ind: 3,
      name: "Left Head",
      x: 52,
      y: 58,
      width: 26,
      height: 26,
      fill: "#F5EFE7",
      stroke: "#DDD4CA",
      ellipseShape: true,
      scaleFrames: [
        keyframe(0, [100, 100, 100], [103, 103, 100]),
        keyframe(45, [103, 103, 100], [100, 100, 100]),
        keyframe(90, [100, 100, 100], [100, 100, 100]),
        keyframe(180, [100, 100, 100]),
      ],
    }),
    // Left person - status dot
    makeShapeLayer({
      ind: 4,
      name: "Left Status",
      x: 62,
      y: 48,
      width: 8,
      height: 8,
      fill: "#0F5A53",
      ellipseShape: true,
      opacityFrames: [
        keyframe(0, 100, 100),
        keyframe(40, 100, 40),
        keyframe(60, 40, 40),
        keyframe(180, 40),
      ],
    }),
    // Right person - body
    makeShapeLayer({
      ind: 5,
      name: "Right Body",
      x: 148,
      y: 82,
      width: 32,
      height: 24,
      radius: 12,
      fill: "#FFFFFF",
      stroke: "#DDD4CA",
    }),
    // Right person - head
    makeShapeLayer({
      ind: 6,
      name: "Right Head",
      x: 148,
      y: 58,
      width: 26,
      height: 26,
      fill: "#F5EFE7",
      stroke: "#DDD4CA",
      ellipseShape: true,
      scaleFrames: [
        keyframe(0, [100, 100, 100], [100, 100, 100]),
        keyframe(60, [100, 100, 100], [103, 103, 100]),
        keyframe(105, [103, 103, 100], [100, 100, 100]),
        keyframe(180, [100, 100, 100]),
      ],
    }),
    // Right person - status dot
    makeShapeLayer({
      ind: 7,
      name: "Right Status",
      x: 158,
      y: 48,
      width: 8,
      height: 8,
      fill: "#0F5A53",
      ellipseShape: true,
      opacityFrames: [
        keyframe(0, 40, 40),
        keyframe(60, 40, 100),
        keyframe(100, 100, 100),
        keyframe(140, 100, 40),
        keyframe(180, 40),
      ],
    }),
    // Document card that travels
    makeShapeLayer({
      ind: 8,
      name: "Document",
      x: 52,
      y: 70,
      width: 26,
      height: 18,
      radius: 6,
      fill: "#7B68FF",
      positionFrames: [
        easeOutKeyframe(0, [52, 70, 0], [52, 64, 0]),
        springKeyframe(20, [52, 64, 0], [100, 56, 0]),
        springKeyframe(60, [100, 56, 0], [148, 64, 0]),
        easeOutKeyframe(80, [148, 64, 0], [148, 70, 0]),
        keyframe(110, [148, 70, 0], [148, 70, 0]),
        easeOutKeyframe(130, [148, 70, 0], [148, 64, 0]),
        springKeyframe(145, [148, 64, 0], [100, 56, 0]),
        springKeyframe(165, [100, 56, 0], [52, 64, 0]),
        easeOutKeyframe(175, [52, 64, 0], [52, 70, 0]),
        keyframe(180, [52, 70, 0]),
      ],
      scaleFrames: [
        keyframe(0, [100, 100, 100], [100, 100, 100]),
        springKeyframe(20, [100, 100, 100], [90, 90, 100]),
        keyframe(40, [90, 90, 100], [110, 110, 100]),
        springKeyframe(60, [110, 110, 100], [100, 100, 100]),
        keyframe(80, [100, 100, 100], [100, 100, 100]),
        keyframe(130, [100, 100, 100], [90, 90, 100]),
        keyframe(150, [90, 90, 100], [110, 110, 100]),
        springKeyframe(165, [110, 110, 100], [100, 100, 100]),
        keyframe(180, [100, 100, 100]),
      ],
    }),
    // Document inner line 1
    makeShapeLayer({
      ind: 9,
      name: "Doc Line 1",
      x: 52,
      y: 67,
      width: 14,
      height: 2.5,
      radius: 1.25,
      fill: "#FFFFFF",
      fillOpacity: 70,
      positionFrames: [
        easeOutKeyframe(0, [52, 67, 0], [52, 61, 0]),
        springKeyframe(20, [52, 61, 0], [100, 53, 0]),
        springKeyframe(60, [100, 53, 0], [148, 61, 0]),
        easeOutKeyframe(80, [148, 61, 0], [148, 67, 0]),
        keyframe(110, [148, 67, 0], [148, 67, 0]),
        easeOutKeyframe(130, [148, 67, 0], [148, 61, 0]),
        springKeyframe(145, [148, 61, 0], [100, 53, 0]),
        springKeyframe(165, [100, 53, 0], [52, 61, 0]),
        easeOutKeyframe(175, [52, 61, 0], [52, 67, 0]),
        keyframe(180, [52, 67, 0]),
      ],
    }),
    // Document inner line 2
    makeShapeLayer({
      ind: 10,
      name: "Doc Line 2",
      x: 52,
      y: 73,
      width: 10,
      height: 2.5,
      radius: 1.25,
      fill: "#FFFFFF",
      fillOpacity: 50,
      positionFrames: [
        easeOutKeyframe(0, [52, 73, 0], [52, 67, 0]),
        springKeyframe(20, [52, 67, 0], [100, 59, 0]),
        springKeyframe(60, [100, 59, 0], [148, 67, 0]),
        easeOutKeyframe(80, [148, 67, 0], [148, 73, 0]),
        keyframe(110, [148, 73, 0], [148, 73, 0]),
        easeOutKeyframe(130, [148, 73, 0], [148, 67, 0]),
        springKeyframe(145, [148, 67, 0], [100, 59, 0]),
        springKeyframe(165, [100, 59, 0], [52, 67, 0]),
        easeOutKeyframe(175, [52, 67, 0], [52, 73, 0]),
        keyframe(180, [52, 73, 0]),
      ],
    }),
    // Ripple on receive
    makeShapeLayer({
      ind: 11,
      name: "Receive Ripple",
      x: 148,
      y: 70,
      width: 40,
      height: 40,
      fill: "#7B68FF",
      fillOpacity: 12,
      ellipseShape: true,
      scaleFrames: [
        keyframe(60, [0, 0, 100], [140, 140, 100]),
        keyframe(90, [140, 140, 100], [140, 140, 100]),
        keyframe(180, [140, 140, 100]),
      ],
      opacityFrames: [
        keyframe(0, 0, 0),
        keyframe(60, 0, 80),
        keyframe(90, 80, 0),
        keyframe(180, 0),
      ],
    }),
  ]);
}

// "Clearer records across repeat visits" — Layered documents revealing structure
function buildRecordsAnimation() {
  return baseAnimation("Outcome Records", [
    // Background subtle grid
    makeShapeLayer({
      ind: 1,
      name: "Grid BG",
      x: 100,
      y: 70,
      width: 160,
      height: 108,
      radius: 18,
      fill: "#F8F4EF",
      fillOpacity: 50,
    }),
    // Back sheet (oldest record)
    makeShapeLayer({
      ind: 2,
      name: "Sheet 3",
      x: 88,
      y: 62,
      width: 72,
      height: 80,
      radius: 14,
      fill: "#EDE6DD",
      stroke: "#DDD4CA",
      positionFrames: [
        keyframe(0, [88, 64, 0], [88, 60, 0]),
        keyframe(90, [88, 60, 0], [88, 64, 0]),
        keyframe(180, [88, 64, 0]),
      ],
      opacityFrames: [
        keyframe(0, 50, 65),
        keyframe(90, 65, 50),
        keyframe(180, 50),
      ],
    }),
    // Middle sheet
    makeShapeLayer({
      ind: 3,
      name: "Sheet 2",
      x: 96,
      y: 68,
      width: 76,
      height: 84,
      radius: 14,
      fill: "#F5EFE7",
      stroke: "#DDD4CA",
      positionFrames: [
        keyframe(0, [96, 70, 0], [96, 66, 0]),
        keyframe(90, [96, 66, 0], [96, 70, 0]),
        keyframe(180, [96, 70, 0]),
      ],
      opacityFrames: [
        keyframe(0, 70, 85),
        keyframe(90, 85, 70),
        keyframe(180, 70),
      ],
    }),
    // Front sheet (current record)
    makeShapeLayer({
      ind: 4,
      name: "Sheet 1",
      x: 106,
      y: 74,
      width: 80,
      height: 88,
      radius: 14,
      fill: "#FFFFFF",
      stroke: "#DDD4CA",
      positionFrames: [
        keyframe(0, [106, 76, 0], [106, 72, 0]),
        keyframe(90, [106, 72, 0], [106, 76, 0]),
        keyframe(180, [106, 76, 0]),
      ],
    }),
    // Text line 1 on front sheet
    makeShapeLayer({
      ind: 5,
      name: "Line 1",
      x: 98,
      y: 48,
      width: 44,
      height: 4,
      radius: 2,
      fill: "#D8D0C7",
      opacityFrames: [
        keyframe(0, 0, 100),
        keyframe(20, 100, 100),
        keyframe(140, 100, 0),
        keyframe(160, 0, 0),
        keyframe(180, 0),
      ],
    }),
    // Text line 2
    makeShapeLayer({
      ind: 6,
      name: "Line 2",
      x: 104,
      y: 58,
      width: 52,
      height: 4,
      radius: 2,
      fill: "#D8D0C7",
      opacityFrames: [
        keyframe(0, 0, 0),
        keyframe(10, 0, 100),
        keyframe(30, 100, 100),
        keyframe(140, 100, 0),
        keyframe(160, 0, 0),
        keyframe(180, 0),
      ],
    }),
    // Text line 3
    makeShapeLayer({
      ind: 7,
      name: "Line 3",
      x: 96,
      y: 68,
      width: 38,
      height: 4,
      radius: 2,
      fill: "#D8D0C7",
      opacityFrames: [
        keyframe(0, 0, 0),
        keyframe(20, 0, 100),
        keyframe(40, 100, 100),
        keyframe(140, 100, 0),
        keyframe(160, 0, 0),
        keyframe(180, 0),
      ],
    }),
    // Highlight bar (scanning effect)
    makeShapeLayer({
      ind: 8,
      name: "Highlight",
      x: 106,
      y: 48,
      width: 64,
      height: 10,
      radius: 5,
      fill: "#0F5A53",
      fillOpacity: 8,
      positionFrames: [
        easeOutKeyframe(0, [106, 42, 0], [106, 48, 0]),
        easeOutKeyframe(40, [106, 48, 0], [106, 58, 0]),
        easeOutKeyframe(80, [106, 58, 0], [106, 68, 0]),
        easeOutKeyframe(100, [106, 68, 0], [106, 80, 0]),
        keyframe(120, [106, 80, 0], [106, 80, 0]),
        keyframe(160, [106, 80, 0], [106, 42, 0]),
        keyframe(180, [106, 42, 0]),
      ],
      opacityFrames: [
        keyframe(0, 0, 80),
        keyframe(20, 80, 80),
        keyframe(100, 80, 0),
        keyframe(130, 0, 0),
        keyframe(160, 0, 80),
        keyframe(180, 80),
      ],
    }),
    // Green check on complete
    makeShapeLayer({
      ind: 9,
      name: "Complete Badge",
      x: 136,
      y: 40,
      width: 16,
      height: 16,
      fill: "#0F5A53",
      ellipseShape: true,
      scaleFrames: [
        keyframe(0, [0, 0, 100], [0, 0, 100]),
        springKeyframe(90, [0, 0, 100], [120, 120, 100]),
        springKeyframe(105, [120, 120, 100], [100, 100, 100]),
        keyframe(140, [100, 100, 100], [0, 0, 100]),
        keyframe(160, [0, 0, 100], [0, 0, 100]),
        keyframe(180, [0, 0, 100]),
      ],
    }),
    // Timeline dots on left side
    makeShapeLayer({
      ind: 10,
      name: "Timeline 1",
      x: 54,
      y: 42,
      width: 6,
      height: 6,
      fill: "#7B68FF",
      ellipseShape: true,
      opacityFrames: [
        keyframe(0, 30, 100),
        keyframe(30, 100, 30),
        keyframe(180, 30),
      ],
    }),
    makeShapeLayer({
      ind: 11,
      name: "Timeline 2",
      x: 54,
      y: 60,
      width: 6,
      height: 6,
      fill: "#7B68FF",
      ellipseShape: true,
      opacityFrames: [
        keyframe(20, 30, 100),
        keyframe(50, 100, 30),
        keyframe(180, 30),
      ],
    }),
    makeShapeLayer({
      ind: 12,
      name: "Timeline 3",
      x: 54,
      y: 78,
      width: 6,
      height: 6,
      fill: "#7B68FF",
      ellipseShape: true,
      opacityFrames: [
        keyframe(40, 30, 100),
        keyframe(70, 100, 30),
        keyframe(180, 30),
      ],
    }),
    // Timeline connector
    makeShapeLayer({
      ind: 13,
      name: "Timeline Line",
      x: 54,
      y: 60,
      width: 2,
      height: 42,
      radius: 1,
      fill: "#7B68FF",
      fillOpacity: 25,
    }),
  ]);
}

// "A calmer day for staff and patients" — Breathing concentric rings with organic motion
function buildCalmAnimation() {
  return baseAnimation("Outcome Calm", [
    // Outermost ring
    makeShapeLayer({
      ind: 1,
      name: "Ring 3",
      x: 100,
      y: 70,
      width: 100,
      height: 100,
      fill: "#F5EFE7",
      fillOpacity: 40,
      ellipseShape: true,
      scaleFrames: [
        keyframe(0, [88, 88, 100], [100, 100, 100]),
        keyframe(90, [100, 100, 100], [88, 88, 100]),
        keyframe(180, [88, 88, 100]),
      ],
      opacityFrames: [
        keyframe(0, 30, 60),
        keyframe(90, 60, 30),
        keyframe(180, 30),
      ],
    }),
    // Middle ring
    makeShapeLayer({
      ind: 2,
      name: "Ring 2",
      x: 100,
      y: 70,
      width: 68,
      height: 68,
      fill: "#EDE8E0",
      stroke: "#DDD4CA",
      strokeWidth: 1,
      ellipseShape: true,
      scaleFrames: [
        keyframe(0, [94, 94, 100], [102, 102, 100]),
        keyframe(90, [102, 102, 100], [94, 94, 100]),
        keyframe(180, [94, 94, 100]),
      ],
      opacityFrames: [
        keyframe(0, 50, 80),
        keyframe(90, 80, 50),
        keyframe(180, 50),
      ],
    }),
    // Inner solid circle
    makeShapeLayer({
      ind: 3,
      name: "Inner Circle",
      x: 100,
      y: 70,
      width: 40,
      height: 40,
      fill: "#FFFFFF",
      stroke: "#E8DFD4",
      ellipseShape: true,
      scaleFrames: [
        keyframe(0, [100, 100, 100], [108, 108, 100]),
        keyframe(90, [108, 108, 100], [100, 100, 100]),
        keyframe(180, [100, 100, 100]),
      ],
    }),
    // Center pulse dot
    makeShapeLayer({
      ind: 4,
      name: "Pulse",
      x: 100,
      y: 70,
      width: 14,
      height: 14,
      fill: "#0F5A53",
      ellipseShape: true,
      scaleFrames: [
        keyframe(0, [100, 100, 100], [115, 115, 100]),
        keyframe(45, [115, 115, 100], [95, 95, 100]),
        keyframe(90, [95, 95, 100], [110, 110, 100]),
        keyframe(135, [110, 110, 100], [100, 100, 100]),
        keyframe(180, [100, 100, 100]),
      ],
    }),
    // Floating accent 1 - top right
    makeShapeLayer({
      ind: 5,
      name: "Accent 1",
      x: 138,
      y: 38,
      width: 8,
      height: 8,
      fill: "#7B68FF",
      ellipseShape: true,
      positionFrames: [
        keyframe(0, [138, 38, 0], [142, 34, 0]),
        keyframe(90, [142, 34, 0], [138, 38, 0]),
        keyframe(180, [138, 38, 0]),
      ],
      opacityFrames: [
        keyframe(0, 40, 80),
        keyframe(90, 80, 40),
        keyframe(180, 40),
      ],
    }),
    // Floating accent 2 - bottom left
    makeShapeLayer({
      ind: 6,
      name: "Accent 2",
      x: 58,
      y: 98,
      width: 6,
      height: 6,
      fill: "#60D9C6",
      ellipseShape: true,
      positionFrames: [
        keyframe(0, [58, 98, 0], [54, 102, 0]),
        keyframe(90, [54, 102, 0], [58, 98, 0]),
        keyframe(180, [58, 98, 0]),
      ],
      opacityFrames: [
        keyframe(0, 30, 70),
        keyframe(90, 70, 30),
        keyframe(180, 30),
      ],
    }),
    // Floating accent 3 - left
    makeShapeLayer({
      ind: 7,
      name: "Accent 3",
      x: 52,
      y: 52,
      width: 5,
      height: 5,
      fill: "#0F5A53",
      fillOpacity: 50,
      ellipseShape: true,
      positionFrames: [
        keyframe(0, [52, 52, 0], [48, 48, 0]),
        keyframe(90, [48, 48, 0], [52, 52, 0]),
        keyframe(180, [52, 52, 0]),
      ],
      opacityFrames: [
        keyframe(0, 20, 60),
        keyframe(90, 60, 20),
        keyframe(180, 20),
      ],
    }),
    // Floating accent 4 - right
    makeShapeLayer({
      ind: 8,
      name: "Accent 4",
      x: 150,
      y: 88,
      width: 5,
      height: 5,
      fill: "#7B68FF",
      fillOpacity: 60,
      ellipseShape: true,
      positionFrames: [
        keyframe(0, [150, 88, 0], [154, 92, 0]),
        keyframe(90, [154, 92, 0], [150, 88, 0]),
        keyframe(180, [150, 88, 0]),
      ],
      opacityFrames: [
        keyframe(0, 25, 55),
        keyframe(90, 55, 25),
        keyframe(180, 25),
      ],
    }),
    // Soft ripple ring (expanding out)
    makeShapeLayer({
      ind: 9,
      name: "Ripple",
      x: 100,
      y: 70,
      width: 30,
      height: 30,
      fill: "#0F5A53",
      fillOpacity: 0,
      stroke: "#0F5A53",
      strokeWidth: 1,
      ellipseShape: true,
      scaleFrames: [
        keyframe(0, [100, 100, 100], [220, 220, 100]),
        keyframe(90, [220, 220, 100], [300, 300, 100]),
        keyframe(120, [300, 300, 100], [100, 100, 100]),
        keyframe(180, [100, 100, 100]),
      ],
      opacityFrames: [
        keyframe(0, 40, 20),
        keyframe(60, 20, 0),
        keyframe(90, 0, 0),
        keyframe(120, 0, 40),
        keyframe(180, 40),
      ],
    }),
  ]);
}

export const outcomeAnimations = {
  focus: buildFlowAnimation(),
  handoff: buildHandoffAnimation(),
  records: buildRecordsAnimation(),
  calm: buildCalmAnimation(),
};

export type OutcomeAnimationKey = keyof typeof outcomeAnimations;

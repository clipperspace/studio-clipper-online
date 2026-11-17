/**
 * Logo Studio Clipper: tombol play yang terpotong diagonal, dengan potongan bawah sedikit bergeser,
 * seperti video yang baru saja di-clip.
 */
type MarkProps = {
  size?: number;
  top?: string;
  bottom?: string;
  label?: string;
  stroke?: boolean;
};

export function LogoMark({ size = 24, top = "#B13BFF", bottom = "#FFCC00", label, stroke = true }: MarkProps) {
  const width = Math.round((size * 104) / 112);
  const s = (c: string) => (stroke ? { stroke: c, strokeWidth: 3, strokeLinejoin: "round" as const } : {});
  return (
    <svg
      viewBox="-12 -6 104 112"
      width={width}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <polygon points="0,0 86,50 50,70.9 0,40" fill={top} {...s(top)} />
      <polygon points="-6,50.3 32.35,74 -6,96.3" fill={bottom} {...s(bottom)} />
    </svg>
  );
}

/** Logo 3D: tumpukan lapisan SVG dengan translateZ, lalu diputar & mengambang (CSS saja). */
export function Logo3D() {
  const depths = [-12, -9, -6, -3, 0, 3, 6, 9, 12];
  return (
    <div className="logo3d">
      <div className="sc-float logo3d-layer">
        <div className="sc-spin logo3d-layer">
          {depths.map((z, i) => {
            const face = i === 0 || i === depths.length - 1;
            return (
              <div key={z} className="logo3d-layer" style={{ transform: `translateZ(${z}px)` }}>
                <LogoMark
                  size={280}
                  top={face ? "#B13BFF" : "#6E1FBF"}
                  bottom={face ? "#FFCC00" : "#C99F00"}
                  label={i === depths.length - 1 ? "Logo 3D Studio Clipper" : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="logo3d-shadow" />
    </div>
  );
}

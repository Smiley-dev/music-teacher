/** The circle of fifths: major keys outside with their sharps or flats,
 * relative minors inside. Clockwise each key is a perfect 5th higher. */

const KEYS: { major: string; minor: string; count: string }[] = [
  { major: "C", minor: "Am", count: "none" },
  { major: "G", minor: "Em", count: "1♯" },
  { major: "D", minor: "Bm", count: "2♯" },
  { major: "A", minor: "F♯m", count: "3♯" },
  { major: "E", minor: "C♯m", count: "4♯" },
  { major: "B / C♭", minor: "G♯m", count: "5♯ / 7♭" },
  { major: "F♯ / G♭", minor: "D♯m / E♭m", count: "6♯ / 6♭" },
  { major: "D♭ / C♯", minor: "B♭m", count: "5♭ / 7♯" },
  { major: "A♭", minor: "Fm", count: "4♭" },
  { major: "E♭", minor: "Cm", count: "3♭" },
  { major: "B♭", minor: "Gm", count: "2♭" },
  { major: "F", minor: "Dm", count: "1♭" },
];

const SIZE = 360;
const C = SIZE / 2;
const OUTER = 172;
const MIDDLE = 122;
const INNER = 78;

function at(i: number, r: number): [number, number] {
  const angle = (i * Math.PI) / 6;
  return [C + r * Math.sin(angle), C - r * Math.cos(angle)];
}

const DESCRIPTION = `Circle of fifths, clockwise from the top: ${KEYS.map(
  (k) => `${k.major} major (${k.count}), relative minor ${k.minor}`,
).join("; ")}.`;

export function CircleOfFifths() {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE}
      height={SIZE}
      className="max-w-full self-center"
      role="img"
      aria-label={DESCRIPTION}
    >
      {[OUTER, MIDDLE, INNER].map((r) => (
        <circle key={r} cx={C} cy={C} r={r} fill="none" className="stroke-border" />
      ))}
      {KEYS.map((_, i) => {
        // Spokes between the keys.
        const [x1, y1] = at(i + 0.5, INNER);
        const [x2, y2] = at(i + 0.5, OUTER);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-border" />;
      })}
      {KEYS.map((k, i) => {
        const [mx, my] = at(i, (OUTER + MIDDLE) / 2);
        const [nx, ny] = at(i, (MIDDLE + INNER) / 2);
        return (
          <g key={k.major}>
            <text
              x={mx}
              y={my - 2}
              textAnchor="middle"
              className="fill-foreground text-[15px] font-extrabold"
            >
              {k.major}
            </text>
            <text
              x={mx}
              y={my + 13}
              textAnchor="middle"
              className="fill-signal font-mono text-[10px] font-bold"
            >
              {k.count}
            </text>
            <text
              x={nx}
              y={ny + 4}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px] font-bold"
            >
              {k.minor}
            </text>
          </g>
        );
      })}
      <text x={C} y={C - 6} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px] uppercase">
        ♯ clockwise
      </text>
      <text x={C} y={C + 10} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px] uppercase">
        ♭ anticlockwise
      </text>
    </svg>
  );
}

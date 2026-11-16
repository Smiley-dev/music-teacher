/** One octave of a piano keyboard, C to C, with key names and, optionally,
 * the half and whole steps between the white keys (the C major scale).
 * Keys keep their real colours in both themes. */

const WHITE = ["C", "D", "E", "F", "G", "A", "B", "C"];
/** Black keys: the white key they follow, and their two names. */
const BLACK: { after: number; names: [string, string] }[] = [
  { after: 0, names: ["C♯", "D♭"] },
  { after: 1, names: ["D♯", "E♭"] },
  { after: 3, names: ["F♯", "G♭"] },
  { after: 4, names: ["G♯", "A♭"] },
  { after: 5, names: ["A♯", "B♭"] },
];
/** Half steps between neighbouring white keys: E–F and B–C. */
const HALF_STEP_AFTER = new Set([2, 6]);

const KEY_W = 44;
const KEY_H = 140;
const BLACK_W = 26;
const BLACK_H = 86;
const STEP_ROW = 30;

export function KeyboardDiagram({ steps = false }: { steps?: boolean }) {
  const width = WHITE.length * KEY_W + 2;
  const height = KEY_H + (steps ? STEP_ROW : 0) + 2;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="max-w-full"
      role="img"
      aria-label={
        steps
          ? "Piano keys from C to C. Between E and F and between B and C is a half step; the other white keys are a whole step apart."
          : "Piano keys from C to C with the names of the white and black keys."
      }
    >
      {WHITE.map((name, i) => (
        <g key={i}>
          <rect
            x={1 + i * KEY_W}
            y={1}
            width={KEY_W}
            height={KEY_H}
            rx={3}
            className="fill-white stroke-neutral-400"
          />
          <text
            x={1 + i * KEY_W + KEY_W / 2}
            y={KEY_H - 12}
            textAnchor="middle"
            className="fill-neutral-700 text-[13px] font-medium"
          >
            {name}
          </text>
        </g>
      ))}
      {BLACK.map(({ after, names }) => {
        const x = 1 + (after + 1) * KEY_W - BLACK_W / 2;
        return (
          <g key={after}>
            <rect x={x} y={1} width={BLACK_W} height={BLACK_H} rx={2} className="fill-neutral-900" />
            {names.map((n, j) => (
              <text
                key={n}
                x={x + BLACK_W / 2}
                y={BLACK_H - 26 + j * 14}
                textAnchor="middle"
                className="fill-white text-[10px]"
              >
                {n}
              </text>
            ))}
          </g>
        );
      })}
      {steps &&
        WHITE.slice(1).map((_, i) => {
          const half = HALF_STEP_AFTER.has(i);
          const x1 = 1 + i * KEY_W + KEY_W / 2;
          const x2 = x1 + KEY_W;
          const y = KEY_H + 10;
          const colour = half ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground";
          return (
            <g key={i} className={colour}>
              <path
                d={`M ${x1 + 4} ${y - 4} L ${x1 + 4} ${y} L ${x2 - 4} ${y} L ${x2 - 4} ${y - 4}`}
                fill="none"
                stroke="currentColor"
              />
              <text
                x={(x1 + x2) / 2}
                y={y + 15}
                textAnchor="middle"
                fill="currentColor"
                className="text-[12px] font-medium"
              >
                {half ? "H" : "W"}
              </text>
            </g>
          );
        })}
    </svg>
  );
}

import clsx from 'clsx';

/** Teal de marca para el icono. */
export const BRAND_TEAL = '#0F766E';

/** Geometría del icono de billetera (caja 64×64). Reutilizada por el favicon y el PDF. */
export const WALLET_GEOMETRY = {
  box: 64,
  body: { x: 3, y: 19, w: 50, h: 39, r: 8.5 },
  card: [
    [16.9, 15.6],
    [43.5, 7.0],
    [47.2, 18.4],
    [20.6, 27.0],
  ],
  cardLines: [
    [
      [21.0, 17.0],
      [41.0, 10.6],
    ],
    [
      [22.5, 19.9],
      [41.7, 13.7],
    ],
  ],
  clasp: { x: 46, y: 28, w: 15, h: 17, r: 6 },
  claspDot: { cx: 53.5, cy: 36.5, r: 2.7 },
  coins: [
    [
      [6, 46],
      [16, 41],
      [25, 46],
      [25, 52],
      [16, 57],
      [6, 52],
    ],
    [
      [25, 49],
      [31, 46],
      [37, 49],
      [37, 54],
      [31, 57],
      [25, 54],
    ],
  ],
  coinRidges: [
    [
      [6, 46],
      [16, 51],
      [25, 46],
    ],
    [
      [25, 49],
      [31, 52],
      [37, 49],
    ],
  ],
} as const;

/**
 * Marca de Neru: icono de billetera en línea teal.
 * Sustituye al antiguo monograma "N" en toda la interfaz.
 */
export function BrandMark({
  size = 44,
  className,
  color = BRAND_TEAL,
}: {
  size?: number;
  className?: string;
  color?: string;
}) {
  const g = WALLET_GEOMETRY;
  const cardPoints = g.card.map(([x, y]) => `${x},${y}`).join(' ');
  const coinPoints = (points: readonly (readonly [number, number])[]) =>
    points.map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke={color}
      strokeWidth={3.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clsx('shrink-0', className)}
      role="img"
      aria-label="Neru"
    >
      <title>Neru</title>

      {/* Cuerpo de la billetera */}
      <rect
        x={g.body.x}
        y={g.body.y}
        width={g.body.w}
        height={g.body.h}
        rx={g.body.r}
        fill="#FFFFFF"
      />

      {/* Monedas apiladas (esquina inferior izquierda) */}
      {g.coins.map((coin) => (
        <polygon key={`coin-${coin[0][0]}-${coin[0][1]}`} points={coinPoints(coin)} fill="#FFFFFF" />
      ))}
      {g.coinRidges.map((ridge) => (
        <polyline key={`ridge-${ridge[0][0]}-${ridge[0][1]}`} points={coinPoints(ridge)} />
      ))}

      {/* Tarjeta asomando por arriba */}
      <polygon points={cardPoints} fill="#FFFFFF" />
      {g.cardLines.map((line) => (
        <line
          key={`cardline-${line[0][0]}`}
          x1={line[0][0]}
          y1={line[0][1]}
          x2={line[1][0]}
          y2={line[1][1]}
        />
      ))}

      {/* Cierre lateral con botón */}
      <rect
        x={g.clasp.x}
        y={g.clasp.y}
        width={g.clasp.w}
        height={g.clasp.h}
        rx={g.clasp.r}
        fill="#FFFFFF"
      />
      <circle cx={g.claspDot.cx} cy={g.claspDot.cy} r={g.claspDot.r} fill={color} stroke="none" />
    </svg>
  );
}

export function BrandLockup({
  subtitle = 'Inventario & POS',
  markSize = 38,
  className,
}: {
  subtitle?: string | null;
  markSize?: number;
  className?: string;
}) {
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <BrandMark size={markSize} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[13.5px] font-semibold tracking-[0.22em] text-petrol-900">
          NERU
        </p>
        {subtitle ? (
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

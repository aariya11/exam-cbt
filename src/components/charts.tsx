import { cn } from "@/components/ui";

// Lightweight dependency-free SVG charts. Each chart ships a screen-reader
// table so the data is fully accessible without hover interactions.

export type ChartPoint = { label: string; value: number };

export function LineChart({
  points,
  height = 180,
  ariaLabel,
  valueSuffix = "",
  className,
}: {
  points: ChartPoint[];
  height?: number;
  ariaLabel: string;
  valueSuffix?: string;
  className?: string;
}) {
  if (points.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-ink-500 dark:text-ink-400">No data in this period yet.</p>
    );
  }

  const width = 640;
  const padX = 8;
  const padY = 12;
  const values = points.map((point) => point.value);
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const stepX = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
  const toY = (value: number) => padY + (1 - (value - min) / span) * (height - padY * 2);
  const coords = points.map((point, index) => ({ x: padX + index * stepX, y: toY(point.value) }));
  const line = coords.map((coord) => `${coord.x.toFixed(1)},${coord.y.toFixed(1)}`).join(" ");
  const area = `${padX},${height - padY} ${line} ${(padX + (points.length - 1) * stepX).toFixed(1)},${height - padY}`;

  return (
    <div className={className}>
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        preserveAspectRatio="none"
      >
        <polygon points={area} className="fill-brand-500/10" />
        <polyline points={line} className="fill-none stroke-brand-500" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((coord, index) => (
          <circle key={index} cx={coord.x} cy={coord.y} r={3} className="fill-brand-500">
            <title>
              {points[index].label}: {points[index].value}
              {valueSuffix}
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink-400 dark:text-ink-500">
        <span>{points[0]?.label}</span>
        {points.length > 2 ? <span>{points[Math.floor(points.length / 2)]?.label}</span> : null}
        <span>{points[points.length - 1]?.label}</span>
      </div>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Label</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={index}>
              <td>{point.label}</td>
              <td>
                {point.value}
                {valueSuffix}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BarChart({
  bars,
  ariaLabel,
  valueSuffix = "",
  className,
  max: maxOverride,
}: {
  bars: ChartPoint[];
  ariaLabel: string;
  valueSuffix?: string;
  className?: string;
  max?: number;
}) {
  if (bars.length === 0) {
    return <p className="py-8 text-center text-xs text-ink-500 dark:text-ink-400">No data yet.</p>;
  }
  const max = maxOverride ?? Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <div className={cn("space-y-2.5", className)} role="img" aria-label={ariaLabel}>
      {bars.map((bar) => (
        <div key={bar.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-xs font-medium text-ink-600 dark:text-ink-300">{bar.label}</span>
            <span className="nums text-xs font-semibold text-ink-900 dark:text-ink-100">
              {bar.value}
              {valueSuffix}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${Math.min(100, (bar.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Label</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar, index) => (
            <tr key={index}>
              <td>{bar.label}</td>
              <td>
                {bar.value}
                {valueSuffix}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

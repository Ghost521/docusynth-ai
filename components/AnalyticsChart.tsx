import React, { useMemo, useState } from 'react';

// Types
interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}

interface MultiSeriesPoint {
  date: string;
  [key: string]: string | number;
}

// Color palette for charts
const CHART_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

// ═══════════════════════════════════════════════════════════════
// LINE CHART
// ═══════════════════════════════════════════════════════════════

interface LineChartProps {
  data: TimeSeriesPoint[];
  height?: number;
  showGrid?: boolean;
  showDots?: boolean;
  showArea?: boolean;
  color?: string;
  title?: string;
  yAxisLabel?: string;
  formatValue?: (value: number) => string;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  height = 200,
  showGrid = true,
  showDots = true,
  showArea = true,
  color = '#10b981',
  title,
  yAxisLabel,
  formatValue = (v) => v.toLocaleString(),
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const values = data.map((d) => d.value);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = 100 - padding.left - padding.right;
    const chartHeight = 100 - padding.top - padding.bottom;

    const points = data.map((point, index) => ({
      x: padding.left + (index / (data.length - 1 || 1)) * chartWidth,
      y: padding.top + chartHeight - ((point.value - min) / range) * chartHeight,
      value: point.value,
      label: point.label || point.date,
      date: point.date,
    }));

    // Y-axis ticks
    const yTicks = [];
    const tickCount = 5;
    for (let i = 0; i <= tickCount; i++) {
      const value = min + (range * i) / tickCount;
      const y = padding.top + chartHeight - (i / tickCount) * chartHeight;
      yTicks.push({ value, y });
    }

    return { points, padding, chartWidth, chartHeight, max, min, yTicks };
  }, [data]);

  if (!chartData || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-secondary text-sm bg-surface rounded-lg border border-border"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const { points, padding, chartWidth, chartHeight, yTicks } = chartData;

  // Create line path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Create area path
  const areaPath = `${linePath} L ${padding.left + chartWidth} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

  return (
    <div className="w-full">
      {title && (
        <h4 className="text-sm font-bold text-main mb-3">{title}</h4>
      )}
      <div className="relative" style={{ height }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* Grid lines */}
          {showGrid && (
            <g className="text-border">
              {yTicks.map((tick, i) => (
                <line
                  key={i}
                  x1={padding.left}
                  y1={tick.y}
                  x2={padding.left + chartWidth}
                  y2={tick.y}
                  stroke="currentColor"
                  strokeWidth="0.2"
                  strokeDasharray="1,1"
                />
              ))}
            </g>
          )}

          {/* Area fill */}
          {showArea && (
            <defs>
              <linearGradient id="area-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
          )}
          {showArea && (
            <path
              d={areaPath}
              fill="url(#area-gradient)"
            />
          )}

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Dots and hover areas */}
          {points.map((point, index) => (
            <g key={index}>
              {/* Hover area */}
              <rect
                x={point.x - 2}
                y={padding.top}
                width={4}
                height={chartHeight}
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(index)}
              />
              {/* Dot */}
              {showDots && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={hoveredIndex === index ? 1 : 0.6}
                  fill={color}
                  className="transition-all"
                />
              )}
            </g>
          ))}

          {/* Y-axis labels */}
          {yTicks.map((tick, i) => (
            <text
              key={i}
              x={padding.left - 2}
              y={tick.y}
              fontSize="3"
              fill="currentColor"
              className="text-secondary"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {formatValue(tick.value)}
            </text>
          ))}

          {/* X-axis labels */}
          {points.filter((_, i) => i % Math.ceil(points.length / 7) === 0 || i === points.length - 1).map((point, i) => (
            <text
              key={i}
              x={point.x}
              y={padding.top + chartHeight + 5}
              fontSize="2.5"
              fill="currentColor"
              className="text-secondary"
              textAnchor="middle"
            >
              {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </text>
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <div
            className="absolute bg-surface border border-border rounded-lg px-2 py-1 text-xs shadow-lg pointer-events-none z-10 whitespace-nowrap"
            style={{
              left: `${points[hoveredIndex].x}%`,
              top: `${points[hoveredIndex].y}%`,
              transform: 'translate(-50%, -120%)',
            }}
          >
            <div className="font-bold text-main">{formatValue(points[hoveredIndex].value)}</div>
            <div className="text-secondary text-[10px]">{points[hoveredIndex].label}</div>
          </div>
        )}
      </div>
      {yAxisLabel && (
        <p className="text-[10px] text-secondary text-center mt-1">{yAxisLabel}</p>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// BAR CHART
// ═══════════════════════════════════════════════════════════════

interface BarChartProps {
  data: DataPoint[];
  height?: number;
  horizontal?: boolean;
  showValues?: boolean;
  title?: string;
  formatValue?: (value: number) => string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 200,
  horizontal = false,
  showValues = true,
  title,
  formatValue = (v) => v.toLocaleString(),
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const max = Math.max(...data.map((d) => d.value), 1);
    const bars = data.map((item, index) => ({
      ...item,
      percentage: (item.value / max) * 100,
      color: item.color || CHART_COLORS[index % CHART_COLORS.length],
    }));

    return { bars, max };
  }, [data]);

  if (!chartData || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-secondary text-sm bg-surface rounded-lg border border-border"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const { bars } = chartData;

  if (horizontal) {
    return (
      <div className="w-full">
        {title && (
          <h4 className="text-sm font-bold text-main mb-3">{title}</h4>
        )}
        <div className="space-y-3" style={{ maxHeight: height, overflowY: 'auto' }}>
          {bars.map((bar, index) => (
            <div
              key={index}
              className="group"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-main font-medium truncate max-w-[60%]">
                  {bar.label}
                </span>
                {showValues && (
                  <span className="text-xs text-secondary font-bold">
                    {formatValue(bar.value)}
                  </span>
                )}
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${bar.percentage}%`,
                    backgroundColor: bar.color,
                    opacity: hoveredIndex === null || hoveredIndex === index ? 1 : 0.4,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Vertical bar chart
  return (
    <div className="w-full">
      {title && (
        <h4 className="text-sm font-bold text-main mb-3">{title}</h4>
      )}
      <div className="flex items-end gap-2 justify-around" style={{ height }}>
        {bars.map((bar, index) => (
          <div
            key={index}
            className="flex flex-col items-center flex-1 max-w-16 group"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="flex-1 w-full flex items-end justify-center">
              <div
                className="w-full max-w-8 rounded-t transition-all duration-300 relative"
                style={{
                  height: `${bar.percentage}%`,
                  minHeight: bar.value > 0 ? 4 : 0,
                  backgroundColor: bar.color,
                  opacity: hoveredIndex === null || hoveredIndex === index ? 1 : 0.4,
                }}
              >
                {showValues && hoveredIndex === index && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-surface border border-border px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap z-10">
                    {formatValue(bar.value)}
                  </div>
                )}
              </div>
            </div>
            <span className="text-[9px] text-secondary mt-1 truncate w-full text-center">
              {bar.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DONUT/PIE CHART
// ═══════════════════════════════════════════════════════════════

interface DonutChartProps {
  data: DataPoint[];
  size?: number;
  thickness?: number;
  showLegend?: boolean;
  showPercentages?: boolean;
  title?: string;
  centerLabel?: string;
  centerValue?: string | number;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  size = 160,
  thickness = 24,
  showLegend = true,
  showPercentages = true,
  title,
  centerLabel,
  centerValue,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return null;

    const radius = 50;
    const innerRadius = radius - thickness / 2;
    let currentAngle = -90; // Start at top

    const segments = data.map((item, index) => {
      const percentage = (item.value / total) * 100;
      const angle = (percentage / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = 50 + radius * Math.cos(startRad);
      const y1 = 50 + radius * Math.sin(startRad);
      const x2 = 50 + radius * Math.cos(endRad);
      const y2 = 50 + radius * Math.sin(endRad);

      const largeArc = angle > 180 ? 1 : 0;

      // For the stroke-based donut
      const pathData =
        angle >= 360
          ? `M 50 ${50 - radius} A ${radius} ${radius} 0 1 1 50 ${50 + radius} A ${radius} ${radius} 0 1 1 50 ${50 - radius}`
          : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

      return {
        ...item,
        percentage,
        angle,
        pathData,
        color: item.color || CHART_COLORS[index % CHART_COLORS.length],
      };
    });

    return { segments, total, innerRadius };
  }, [data, thickness]);

  if (!chartData) {
    return (
      <div
        className="flex items-center justify-center text-secondary text-sm bg-surface rounded-lg border border-border"
        style={{ height: size }}
      >
        No data available
      </div>
    );
  }

  const { segments, total, innerRadius } = chartData;
  const circumference = 2 * Math.PI * 50;

  return (
    <div className="w-full">
      {title && (
        <h4 className="text-sm font-bold text-main mb-3">{title}</h4>
      )}
      <div className="flex items-center gap-6 flex-wrap justify-center">
        {/* Chart */}
        <div className="relative" style={{ width: size, height: size }}>
          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="50"
              fill="none"
              stroke="currentColor"
              strokeWidth={thickness}
              className="text-border"
            />
            {/* Segments */}
            {segments.map((segment, index) => {
              const offset = segments
                .slice(0, index)
                .reduce((sum, s) => sum + (s.percentage / 100) * circumference, 0);
              const length = (segment.percentage / 100) * circumference;

              return (
                <circle
                  key={index}
                  cx="50"
                  cy="50"
                  r="50"
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  className="transition-all duration-300 cursor-pointer"
                  style={{
                    opacity: hoveredIndex === null || hoveredIndex === index ? 1 : 0.4,
                  }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}
          </svg>
          {/* Center content */}
          {(centerLabel || centerValue) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {centerValue !== undefined && (
                <span className="text-xl font-bold text-main">
                  {typeof centerValue === 'number' ? centerValue.toLocaleString() : centerValue}
                </span>
              )}
              {centerLabel && (
                <span className="text-[10px] text-secondary">{centerLabel}</span>
              )}
            </div>
          )}
          {/* Hover tooltip */}
          {hoveredIndex !== null && segments[hoveredIndex] && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface border border-border rounded-lg px-2 py-1 text-xs shadow-lg pointer-events-none z-10 whitespace-nowrap">
              <div className="font-bold text-main">{segments[hoveredIndex].label}</div>
              <div className="text-secondary">
                {segments[hoveredIndex].value.toLocaleString()}
                {showPercentages && ` (${segments[hoveredIndex].percentage.toFixed(1)}%)`}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="flex flex-col gap-2">
            {segments.map((segment, index) => (
              <div
                key={index}
                className="flex items-center gap-2 cursor-pointer transition-opacity"
                style={{
                  opacity: hoveredIndex === null || hoveredIndex === index ? 1 : 0.4,
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-xs text-main truncate max-w-24">
                  {segment.label}
                </span>
                {showPercentages && (
                  <span className="text-[10px] text-secondary ml-auto">
                    {segment.percentage.toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MULTI-LINE CHART
// ═══════════════════════════════════════════════════════════════

interface MultiLineChartProps {
  data: MultiSeriesPoint[];
  series: { key: string; label: string; color?: string }[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  title?: string;
  formatValue?: (value: number) => string;
}

export const MultiLineChart: React.FC<MultiLineChartProps> = ({
  data,
  series,
  height = 200,
  showGrid = true,
  showLegend = true,
  title,
  formatValue = (v) => v.toLocaleString(),
}) => {
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);

  const chartData = useMemo(() => {
    if (data.length === 0 || series.length === 0) return null;

    const allValues = series.flatMap((s) =>
      data.map((d) => (typeof d[s.key] === 'number' ? (d[s.key] as number) : 0))
    );
    const max = Math.max(...allValues, 1);
    const min = Math.min(...allValues, 0);
    const range = max - min || 1;

    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = 100 - padding.left - padding.right;
    const chartHeight = 100 - padding.top - padding.bottom;

    const seriesData = series.map((s, seriesIndex) => {
      const points = data.map((point, index) => {
        const value = typeof point[s.key] === 'number' ? (point[s.key] as number) : 0;
        return {
          x: padding.left + (index / (data.length - 1 || 1)) * chartWidth,
          y: padding.top + chartHeight - ((value - min) / range) * chartHeight,
          value,
          date: point.date,
        };
      });

      return {
        ...s,
        color: s.color || CHART_COLORS[seriesIndex % CHART_COLORS.length],
        points,
        path: points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' '),
      };
    });

    const yTicks = [];
    const tickCount = 5;
    for (let i = 0; i <= tickCount; i++) {
      const value = min + (range * i) / tickCount;
      const y = padding.top + chartHeight - (i / tickCount) * chartHeight;
      yTicks.push({ value, y });
    }

    return { seriesData, padding, chartWidth, chartHeight, yTicks };
  }, [data, series]);

  if (!chartData) {
    return (
      <div
        className="flex items-center justify-center text-secondary text-sm bg-surface rounded-lg border border-border"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const { seriesData, padding, chartWidth, chartHeight, yTicks } = chartData;

  return (
    <div className="w-full">
      {title && (
        <h4 className="text-sm font-bold text-main mb-3">{title}</h4>
      )}
      {showLegend && (
        <div className="flex flex-wrap gap-3 mb-3">
          {seriesData.map((s) => (
            <div
              key={s.key}
              className="flex items-center gap-1.5 cursor-pointer transition-opacity"
              style={{
                opacity: hoveredSeries === null || hoveredSeries === s.key ? 1 : 0.3,
              }}
              onMouseEnter={() => setHoveredSeries(s.key)}
              onMouseLeave={() => setHoveredSeries(null)}
            >
              <div
                className="w-3 h-0.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-xs text-secondary">{s.label}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ height }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Grid */}
          {showGrid && (
            <g className="text-border">
              {yTicks.map((tick, i) => (
                <line
                  key={i}
                  x1={padding.left}
                  y1={tick.y}
                  x2={padding.left + chartWidth}
                  y2={tick.y}
                  stroke="currentColor"
                  strokeWidth="0.2"
                  strokeDasharray="1,1"
                />
              ))}
            </g>
          )}

          {/* Lines */}
          {seriesData.map((s) => (
            <path
              key={s.key}
              d={s.path}
              fill="none"
              stroke={s.color}
              strokeWidth="0.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-opacity"
              style={{
                opacity: hoveredSeries === null || hoveredSeries === s.key ? 1 : 0.2,
              }}
            />
          ))}

          {/* Y-axis labels */}
          {yTicks.map((tick, i) => (
            <text
              key={i}
              x={padding.left - 2}
              y={tick.y}
              fontSize="3"
              fill="currentColor"
              className="text-secondary"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {formatValue(tick.value)}
            </text>
          ))}

          {/* X-axis labels */}
          {data.filter((_, i) => i % Math.ceil(data.length / 7) === 0 || i === data.length - 1).map((point, i) => {
            const x = padding.left + (data.indexOf(point) / (data.length - 1 || 1)) * chartWidth;
            return (
              <text
                key={i}
                x={x}
                y={padding.top + chartHeight + 5}
                fontSize="2.5"
                fill="currentColor"
                className="text-secondary"
                textAnchor="middle"
              >
                {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// STACKED BAR CHART
// ═══════════════════════════════════════════════════════════════

interface StackedBarChartProps {
  data: MultiSeriesPoint[];
  series: { key: string; label: string; color?: string }[];
  height?: number;
  title?: string;
  formatValue?: (value: number) => string;
}

export const StackedBarChart: React.FC<StackedBarChartProps> = ({
  data,
  series,
  height = 200,
  title,
  formatValue = (v) => v.toLocaleString(),
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartData = useMemo(() => {
    if (data.length === 0 || series.length === 0) return null;

    const totals = data.map((d) =>
      series.reduce((sum, s) => sum + (typeof d[s.key] === 'number' ? (d[s.key] as number) : 0), 0)
    );
    const maxTotal = Math.max(...totals, 1);

    const bars = data.map((point, index) => {
      let cumulative = 0;
      const segments = series.map((s, seriesIndex) => {
        const value = typeof point[s.key] === 'number' ? (point[s.key] as number) : 0;
        const start = cumulative;
        cumulative += value;
        return {
          key: s.key,
          label: s.label,
          value,
          start,
          end: cumulative,
          color: s.color || CHART_COLORS[seriesIndex % CHART_COLORS.length],
        };
      });
      return {
        date: point.date,
        total: totals[index],
        percentage: (totals[index] / maxTotal) * 100,
        segments,
      };
    });

    return { bars, maxTotal, series };
  }, [data, series]);

  if (!chartData) {
    return (
      <div
        className="flex items-center justify-center text-secondary text-sm bg-surface rounded-lg border border-border"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const { bars } = chartData;

  return (
    <div className="w-full">
      {title && (
        <h4 className="text-sm font-bold text-main mb-3">{title}</h4>
      )}
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3">
        {series.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: s.color || CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="text-xs text-secondary">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-1" style={{ height }}>
        {bars.map((bar, index) => (
          <div
            key={index}
            className="flex-1 flex flex-col relative group"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div
              className="flex flex-col-reverse rounded-t overflow-hidden"
              style={{ height: `${bar.percentage}%`, minHeight: bar.total > 0 ? 4 : 0 }}
            >
              {bar.segments.map((segment) => (
                <div
                  key={segment.key}
                  className="transition-opacity"
                  style={{
                    flex: segment.value,
                    backgroundColor: segment.color,
                    opacity: hoveredIndex === null || hoveredIndex === index ? 1 : 0.4,
                  }}
                />
              ))}
            </div>
            <span className="text-[8px] text-secondary mt-1 text-center truncate">
              {new Date(bar.date).toLocaleDateString('en-US', { weekday: 'short' })}
            </span>
            {/* Tooltip */}
            {hoveredIndex === index && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface border border-border rounded-lg px-2 py-1 text-xs shadow-lg z-10 whitespace-nowrap">
                <div className="font-bold text-main mb-1">
                  {new Date(bar.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                {bar.segments.filter(s => s.value > 0).map((segment) => (
                  <div key={segment.key} className="flex items-center gap-1">
                    <div
                      className="w-2 h-2 rounded-sm"
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className="text-secondary">{segment.label}:</span>
                    <span className="text-main font-medium">{formatValue(segment.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default {
  LineChart,
  BarChart,
  DonutChart,
  MultiLineChart,
  StackedBarChart,
};

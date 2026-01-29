import React from 'react';
import { Icons } from './Icon';

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}

// Simple SVG sparkline mini-chart
const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = 'currentColor',
  height = 24,
  width = 60,
}) => {
  if (data.length === 0) {
    return <div style={{ width, height }} />;
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1 || 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  // Create gradient fill path
  const fillPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`sparkline-gradient-${data.join('-')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        fill={`url(#sparkline-gradient-${data.join('-')})`}
        points={fillPoints}
      />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

interface AnalyticsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  sparklineData?: number[];
  icon?: React.ReactNode;
  iconColor?: string;
  onClick?: () => void;
  loading?: boolean;
  compact?: boolean;
}

const AnalyticsCard: React.FC<AnalyticsCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  sparklineData,
  icon,
  iconColor = 'text-primary',
  onClick,
  loading = false,
  compact = false,
}) => {
  const formatTrend = (trendValue: number): string => {
    const absValue = Math.abs(trendValue);
    if (absValue >= 1000) {
      return `${(absValue / 1000).toFixed(1)}K`;
    }
    return absValue.toFixed(1);
  };

  const getTrendColor = (isPositive: boolean): string => {
    return isPositive ? 'text-emerald-500' : 'text-red-500';
  };

  if (loading) {
    return (
      <div className={`bg-background border border-border rounded-xl ${compact ? 'p-3' : 'p-4'} animate-pulse`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-4 bg-border rounded" />
          <div className="h-3 bg-border rounded w-16" />
        </div>
        <div className={`${compact ? 'h-6' : 'h-8'} bg-border rounded w-12 mb-1`} />
        <div className="h-2 bg-border rounded w-10" />
      </div>
    );
  }

  return (
    <div
      className={`
        bg-background border border-border rounded-xl ${compact ? 'p-3' : 'p-4'}
        transition-all duration-200
        ${onClick ? 'cursor-pointer hover:border-primary/50 hover:shadow-md' : ''}
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon && (
            <div className={iconColor}>
              {icon}
            </div>
          )}
          <span className="text-[10px] text-secondary uppercase tracking-widest font-medium">
            {title}
          </span>
        </div>
        {sparklineData && sparklineData.length > 0 && (
          <Sparkline
            data={sparklineData}
            color={trend?.isPositive === false ? '#ef4444' : '#10b981'}
            height={20}
            width={50}
          />
        )}
      </div>

      {/* Value */}
      <div className="flex items-end justify-between">
        <div>
          <p className={`${compact ? 'text-xl' : 'text-2xl'} font-bold text-main leading-none`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-[10px] text-secondary mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Trend Indicator */}
        {trend && (
          <div className={`flex items-center gap-0.5 ${getTrendColor(trend.isPositive)}`}>
            {trend.isPositive ? (
              <Icons.TrendUp className="w-3.5 h-3.5" />
            ) : (
              <Icons.TrendDown className="w-3.5 h-3.5" />
            )}
            <span className="text-xs font-bold">
              {formatTrend(trend.value)}%
            </span>
          </div>
        )}
      </div>

      {/* Click indicator */}
      {onClick && (
        <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
          <span className="text-[9px] text-secondary uppercase tracking-wider">
            View Details
          </span>
          <Icons.ChevronRight className="w-3 h-3 text-secondary" />
        </div>
      )}
    </div>
  );
};

// Compound component for grouping cards
interface AnalyticsCardGroupProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}

export const AnalyticsCardGroup: React.FC<AnalyticsCardGroupProps> = ({
  children,
  columns = 4,
}) => {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {children}
    </div>
  );
};

export default AnalyticsCard;

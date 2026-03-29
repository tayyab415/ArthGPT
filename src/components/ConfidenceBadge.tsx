import { AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

/**
 * ConfidenceBadge displays the confidence level of data provenance.
 * - HIGH (green): Data from RAG store (AMFI factsheets)
 * - MEDIUM (yellow): Data from Exa MCP (financial reports)
 * - LOW (red): Data from Google Search (estimated)
 */
export function ConfidenceBadge({ level, showLabel = true, size = 'sm' }: ConfidenceBadgeProps) {
  const config = {
    HIGH: {
      icon: CheckCircle2,
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-500',
      label: 'High Confidence',
      tooltip: 'Data from official AMFI factsheets',
    },
    MEDIUM: {
      icon: AlertCircle,
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-500',
      label: 'Medium Confidence',
      tooltip: 'Data from financial reports (Exa)',
    },
    LOW: {
      icon: AlertTriangle,
      bg: 'bg-coral-500/10',
      border: 'border-coral-500/30',
      text: 'text-coral-500',
      label: 'Low Confidence',
      tooltip: 'Estimated from web search',
    },
  };

  const { icon: Icon, bg, border, text, label, tooltip } = config[level];
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1';

  return (
    <span 
      className={`inline-flex items-center gap-1 rounded-md ${bg} ${border} border ${padding}`}
      title={tooltip}
    >
      <Icon className={`${iconSize} ${text}`} />
      {showLabel && (
        <span className={`${textSize} font-medium ${text}`}>
          {level}
        </span>
      )}
    </span>
  );
}

/**
 * Compact badge for table cells
 */
export function ConfidenceDot({ level }: { level: ConfidenceLevel }) {
  const colors = {
    HIGH: 'bg-emerald-500',
    MEDIUM: 'bg-amber-500',
    LOW: 'bg-coral-500',
  };

  const tooltips = {
    HIGH: 'High confidence (AMFI data)',
    MEDIUM: 'Medium confidence (Exa)',
    LOW: 'Low confidence (estimated)',
  };

  return (
    <span 
      className={`inline-block w-2 h-2 rounded-full ${colors[level]}`}
      title={tooltips[level]}
    />
  );
}

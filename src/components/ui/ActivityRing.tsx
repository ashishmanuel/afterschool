'use client';

interface ActivityRingProps {
  size?: number;
  strokeWidth?: number;
  rings: {
    progress: number; // 0 to 100
    color: string;
    label: string;
    icon?: string;
  }[];
  showLabels?: boolean;
  animated?: boolean;
}

export default function ActivityRing({
  size = 120,
  strokeWidth = 10,
  rings,
  showLabels = false,
  animated = true,
}: ActivityRingProps) {
  const center = size / 2;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {rings.map((ring, index) => {
          const gap = strokeWidth + 4;
          const radius = center - strokeWidth / 2 - index * gap;
          const circumference = 2 * Math.PI * radius;
          const cappedProgress = Math.min(ring.progress, 100);
          const offset = circumference - (cappedProgress / 100) * circumference;

          return (
            <g key={index}>
              {/* Background ring */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="var(--border)"
                strokeWidth={strokeWidth}
                opacity={0.5}
              />
              {/* Progress ring */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={ring.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={animated ? offset : offset}
                className={animated ? 'ring-animate' : ''}
                style={
                  animated
                    ? {
                        '--ring-circumference': `${circumference}`,
                        '--ring-offset': `${offset}`,
                      } as React.CSSProperties
                    : {}
                }
              />
            </g>
          );
        })}
      </svg>

      {/* Center icon/text */}
      {rings.length === 1 && rings[0].icon && (
        <div className="absolute inset-0 flex items-center justify-center text-3xl">
          {rings[0].icon}
        </div>
      )}

      {/* Labels below */}
      {showLabels && (
        <div className="flex justify-center gap-3 mt-2">
          {rings.map((ring, index) => (
            <div key={index} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: ring.color }}
              />
              <span className="text-xs text-[var(--muted)]">{ring.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Dynamic ring data type (matches DailyProgress from database.ts)
export interface DynamicRing {
  progress: number;
  color: string;
  label: string;
  icon: string;
}

// Nested concentric ring for the kid dashboard (Apple Watch style)
// Now accepts dynamic ring data instead of hardcoded math/reading/chores
export function NestedActivityRings({
  rings,
  size = 200,
}: {
  rings: DynamicRing[];
  size?: number;
}) {
  // Fallback to defaults if no rings provided
  const displayRings = rings.length > 0
    ? rings.map((r) => ({
        progress: r.progress,
        color: r.color,
        label: r.label,
        icon: r.icon,
      }))
    : [
        { progress: 0, color: '#FF6B6B', label: 'Math', icon: '📐' },
        { progress: 0, color: '#4ECDC4', label: 'Reading', icon: '📖' },
        { progress: 0, color: '#6BCF7F', label: 'Chores', icon: '🧹' },
      ];

  return (
    <ActivityRing
      size={size}
      strokeWidth={size / 12}
      rings={displayRings}
      showLabels
      animated
    />
  );
}

// Mini ring for weekly history
export function MiniRing({
  progress,
  color,
  size = 24,
}: {
  progress: number;
  color: string;
  size?: number;
}) {
  const strokeWidth = 3;
  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={strokeWidth}
        opacity={0.3}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

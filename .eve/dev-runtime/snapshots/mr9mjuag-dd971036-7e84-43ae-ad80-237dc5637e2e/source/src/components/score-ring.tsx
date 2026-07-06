import { cn } from "@/lib/utils"
import { scoreColorVar, scoreLabel } from "@/lib/scores"

interface ScoreRingProps {
  score: number
  size?: number
  strokeWidth?: number
  showLabel?: boolean
  className?: string
}

export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 10,
  showLabel = true,
  className,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = scoreColorVar(score)

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-semibold tabular-nums leading-none"
          style={{ color, fontSize: size * 0.3 }}
        >
          {score}
        </span>
        {showLabel && (
          <span
            className="mt-1 font-medium uppercase tracking-wide text-muted-foreground"
            style={{ fontSize: size * 0.1 }}
          >
            {scoreLabel(score)}
          </span>
        )}
      </div>
    </div>
  )
}

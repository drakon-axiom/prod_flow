import { cn } from '../../utils/cn'

interface RunProgressBarProps {
  completed: number
  total: number
  className?: string
}

export function RunProgressBar({ completed, total, className }: RunProgressBarProps) {
  const pct = total > 0 ? (completed / total) * 100 : 0

  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{completed} of {total} steps</span>
        <span className="font-medium text-gray-900">{Math.round(pct)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={cn(
            'h-2.5 rounded-full transition-all duration-300',
            pct >= 100 ? 'bg-green-500' : 'bg-indigo-600',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

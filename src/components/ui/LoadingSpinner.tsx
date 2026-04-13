import { cn } from '../../utils/cn'

interface LoadingSpinnerProps {
  text?: string
  className?: string
}

export function LoadingSpinner({ text, className }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <svg className="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {text && <p className="mt-3 text-sm text-gray-500">{text}</p>}
    </div>
  )
}

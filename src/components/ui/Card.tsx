import type { HTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean
}

export function Card({ padding = true, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 shadow-sm',
        padding && 'p-6',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

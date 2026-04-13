export const ROLES = ['admin', 'operator'] as const
export type Role = (typeof ROLES)[number]

export const QUEUE_STATUSES = ['queued', 'ready', 'in_progress', 'paused', 'completed', 'cancelled'] as const
export type QueueStatus = (typeof QUEUE_STATUSES)[number]

export const RUN_STATUSES = ['in_progress', 'paused', 'completed', 'cancelled'] as const
export type RunStatus = (typeof RUN_STATUSES)[number]

export const STEP_STATUSES = ['pending', 'in_progress', 'completed', 'skipped'] as const
export type StepStatus = (typeof STEP_STATUSES)[number]

export const FIELD_TYPES = ['text', 'number', 'checkbox', 'select', 'textarea'] as const
export type FieldType = (typeof FIELD_TYPES)[number]

export const QUEUE_STATUS_COLORS: Record<QueueStatus, string> = {
  queued: 'bg-gray-100 text-gray-700',
  ready: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  paused: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export const RUN_STATUS_COLORS: Record<RunStatus, string> = {
  in_progress: 'bg-yellow-100 text-yellow-700',
  paused: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

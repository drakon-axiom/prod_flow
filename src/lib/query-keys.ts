export const queryKeys = {
  ingredients: {
    all: ['ingredients'] as const,
    detail: (id: string) => ['ingredients', id] as const,
  },
  fieldTemplates: {
    all: ['field-templates'] as const,
  },
  formulas: {
    all: ['formulas'] as const,
    detail: (id: string) => ['formulas', id] as const,
  },
  queue: {
    all: ['production-queue'] as const,
  },
  runs: {
    all: ['production-runs'] as const,
    detail: (id: string) => ['production-runs', id] as const,
  },
  users: {
    all: ['users'] as const,
  },
  dashboard: {
    stats: ['dashboard-stats'] as const,
  },
} as const

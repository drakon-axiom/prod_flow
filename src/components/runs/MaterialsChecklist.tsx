import { useState } from 'react'
import { Card } from '../ui/Card'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import type { Tables } from '../../types'

interface MaterialsChecklistProps {
  materials: Tables<'run_materials'>[]
}

export function MaterialsChecklist({ materials }: MaterialsChecklistProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <Card padding={false}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left"
      >
        {expanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
        <span className="text-sm font-semibold text-gray-900">Materials ({materials.length})</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Material</th>
                <th className="pb-2 font-medium">Needed</th>
                <th className="pb-2 font-medium">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {materials.map((m) => (
                <tr key={m.id}>
                  <td className="py-2">
                    <span className="font-medium">{m.ingredient_name}</span>
                    {m.sku && <span className="text-gray-400 ml-2 text-xs">{m.sku}</span>}
                  </td>
                  <td className="py-2 font-mono">{Number(m.scaled_quantity).toFixed(2)}</td>
                  <td className="py-2 text-gray-500">{m.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

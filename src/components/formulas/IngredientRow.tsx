import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { TrashIcon } from '@heroicons/react/24/outline'
import type { Tables } from '../../types'

interface IngredientRowProps {
  ingredient: {
    ingredient_id: string
    quantity: string
    notes: string
  }
  index: number
  allIngredients: Tables<'ingredients'>[]
  onChange: (index: number, field: string, value: string) => void
  onRemove: (index: number) => void
}

export function IngredientRow({ ingredient, index, allIngredients, onChange, onRemove }: IngredientRowProps) {
  const options = allIngredients.map((i) => ({
    value: i.id,
    label: `${i.name}${i.sku ? ` (${i.sku})` : ''} — ${i.unit}`,
  }))

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex-1">
        <Select
          value={ingredient.ingredient_id}
          onChange={(e) => onChange(index, 'ingredient_id', e.target.value)}
          options={options}
          placeholder="Select ingredient..."
        />
      </div>
      <div className="w-32">
        <Input
          type="number"
          step="0.0001"
          value={ingredient.quantity}
          onChange={(e) => onChange(index, 'quantity', e.target.value)}
          placeholder="Qty"
          required
        />
      </div>
      <div className="flex-1">
        <Input
          value={ingredient.notes}
          onChange={(e) => onChange(index, 'notes', e.target.value)}
          placeholder="Notes (optional)"
        />
      </div>
      <Button variant="ghost" size="sm" onClick={() => onRemove(index)} className="mt-1">
        <TrashIcon className="h-4 w-4 text-red-500" />
      </Button>
    </div>
  )
}

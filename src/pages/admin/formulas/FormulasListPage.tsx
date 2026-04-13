import { useNavigate } from 'react-router-dom'
import { useFormulas } from '../../../api/formulas'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { DataTable } from '../../../components/ui/DataTable'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'
import { PlusIcon } from '@heroicons/react/24/outline'

export default function FormulasListPage() {
  const navigate = useNavigate()
  const { data: formulas, isLoading } = useFormulas()

  if (isLoading) return <LoadingSpinner text="Loading formulas..." />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Formulas</h1>
          <p className="mt-1 text-sm text-gray-500">{formulas?.length ?? 0} formula{(formulas?.length ?? 0) !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => navigate('/admin/formulas/new')}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Formula
        </Button>
      </div>

      <Card padding={false}>
        <DataTable
          keyExtractor={(row) => row.id}
          onRowClick={(row) => navigate(`/admin/formulas/${row.id}`)}
          emptyMessage="No formulas yet"
          data={formulas ?? []}
          columns={[
            { key: 'name', header: 'Formula Name' },
            { key: 'product_name', header: 'Product' },
            {
              key: 'version',
              header: 'Version',
              render: (r) => {
                const cv = Array.isArray(r.current_version) ? r.current_version[0] : r.current_version
                return cv ? `v${cv.version_number}` : '-'
              },
            },
            {
              key: 'batch',
              header: 'Base Batch',
              render: (r) => {
                const cv = Array.isArray(r.current_version) ? r.current_version[0] : r.current_version
                return cv ? `${cv.base_batch_size} ${cv.base_batch_unit}` : '-'
              },
            },
            {
              key: 'created_at',
              header: 'Created',
              render: (r) => new Date(r.created_at).toLocaleDateString(),
            },
          ]}
        />
      </Card>
    </div>
  )
}

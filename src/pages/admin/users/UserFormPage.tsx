import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateUser } from '../../../api/users'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Card } from '../../../components/ui/Card'
import { useToast } from '../../../components/ui/Toast'

export default function UserFormPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const createMutation = useCreateUser()

  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'operator' })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createMutation.mutate(form, {
      onSuccess: () => {
        toast('success', 'User created')
        navigate('/admin/users')
      },
      onError: (err) => toast('error', err.message),
    })
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New User</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Full Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          <Input label="Temporary Password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} />
          <Select label="Role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} options={[{ value: 'operator', label: 'Operator' }, { value: 'admin', label: 'Admin' }]} />
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={createMutation.isPending}>Create User</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/admin/users')}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

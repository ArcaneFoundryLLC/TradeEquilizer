'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Card, CardContent } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'

interface WantItem {
  id: string
  itemId: string
  itemName: string
  itemSet: string
  itemCollectorNumber: string
  itemImageUrl?: string
  quantity: number
  minCondition: 'NM' | 'LP' | 'MP' | 'HP'
  languageOk: string[]
  finishOk: ('normal' | 'foil' | 'etched' | 'showcase')[]
  priority: 1 | 2 | 3 // 1 = Must have, 2 = Want, 3 = Nice to have
}

interface WantFormData {
  itemId: string
  quantity: number
  minCondition: 'NM' | 'LP' | 'MP' | 'HP'
  languageOk: string[]
  finishOk: ('normal' | 'foil' | 'etched' | 'showcase')[]
  priority: 1 | 2 | 3
}

export default function WantListPage() {
  const { user } = useAuth()
  const [wants, setWants] = useState<WantItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<WantItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [formData, setFormData] = useState<WantFormData>({
    itemId: '',
    quantity: 1,
    minCondition: 'NM',
    languageOk: ['en'],
    finishOk: ['normal'],
    priority: 2,
  })

  // Fetch want list items
  useEffect(() => {
    if (!user) return

    const fetchWants = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await fetch('/api/wants')
        
        if (!response.ok) {
          // If API doesn't exist yet, show empty state
          if (response.status === 404) {
            setWants([])
            return
          }
          throw new Error('Failed to fetch want list')
        }

        const data = await response.json()
        setWants(data.data || [])
      } catch (err) {
        // Gracefully handle missing API - show empty state
        console.warn('Wants API not available yet:', err)
        setWants([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchWants()
  }, [user])

  const handleAddItem = async () => {
    if (!formData.itemId) {
      setError('Please select a card')
      return
    }

    try {
      setError(null)
      const response = await fetch('/api/wants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add item')
      }

      const newItem = await response.json()
      setWants([...wants, newItem])
      setIsAddModalOpen(false)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item')
    }
  }

  const handleUpdateItem = async () => {
    if (!editingItem) return

    try {
      setError(null)
      // The API will forward these fields directly to the DB update call.
      // Use snake_case DB column names so the update doesn't include unexpected keys.
      const response = await fetch('/api/wants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingItem.id,
          item_id: formData.itemId,
          quantity: formData.quantity,
          min_condition: formData.minCondition,
          language_ok: formData.languageOk,
          finish_ok: formData.finishOk,
          priority: formData.priority,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update item')
      }

      const updatedItem = await response.json()
      setWants(wants.map(item => item.id === updatedItem.id ? updatedItem : item))
      setEditingItem(null)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item')
    }
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to remove this item from your want list?')) {
      return
    }

    try {
      setError(null)
      // The API DELETE handler reads JSON body for the id (no path param)
      const response = await fetch('/api/wants', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (!response.ok) {
        throw new Error('Failed to delete item')
      }

      setWants(wants.filter(item => item.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item')
    }
  }

  const resetForm = () => {
    setFormData({
      itemId: '',
      quantity: 1,
      minCondition: 'NM',
      languageOk: ['en'],
      finishOk: ['normal'],
      priority: 2,
    })
  }

  const openEditModal = (item: WantItem) => {
    setEditingItem(item)
    setFormData({
      itemId: item.itemId,
      quantity: item.quantity,
      minCondition: item.minCondition,
      languageOk: item.languageOk,
      finishOk: item.finishOk,
      priority: item.priority,
    })
  }

  const toggleLanguage = (lang: string) => {
    const newLanguages = formData.languageOk.includes(lang)
      ? formData.languageOk.filter(l => l !== lang)
      : [...formData.languageOk, lang]
    setFormData({ ...formData, languageOk: newLanguages })
  }

  const toggleFinish = (finish: 'normal' | 'foil' | 'etched' | 'showcase') => {
    const newFinishes = formData.finishOk.includes(finish)
      ? formData.finishOk.filter(f => f !== finish)
      : [...formData.finishOk, finish]
    setFormData({ ...formData, finishOk: newFinishes })
  }

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 1: return 'Must Have'
      case 2: return 'Want'
      case 3: return 'Nice to Have'
      default: return 'Want'
    }
  }

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'bg-red-100 text-red-800 border-red-200'
      case 2: return 'bg-blue-100 text-blue-800 border-blue-200'
      case 3: return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const filteredWants = wants.filter(item =>
    item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.itemSet.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <ProtectedRoute>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Want List</h1>
            <p className="mt-2 text-sm text-gray-500">
              Track the cards you are looking for.
            </p>
          </div>
          <Button onClick={() => setIsAddModalOpen(true)}>Add Want</Button>
        </header>

        {/* Search */}
        <section className="mb-6">
          <Input
            type="text"
            placeholder="Search by card name or set..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </section>

        {/* Error Display */}
        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Want List */}
        <section>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <div className="mb-3 h-32 w-full animate-pulse rounded-md bg-gray-100" />
                  <div className="mb-2 h-4 w-2/3 animate-pulse rounded bg-gray-100" />
                  <div className="mb-4 h-5 w-full animate-pulse rounded bg-gray-100" />
                </Card>
              ))}
            </div>
          ) : filteredWants.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500 mb-4">
                  {searchQuery ? 'No items found matching your search.' : 'Your want list is empty.'}
                </p>
                <Button onClick={() => setIsAddModalOpen(true)}>
                  Add Your First Want
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredWants.map((item) => (
                <Card key={item.id}>
                  {item.itemImageUrl && (
                    <img
                      src={item.itemImageUrl}
                      alt={item.itemName}
                      className="mb-3 h-40 w-full rounded-md object-contain bg-gray-50"
                    />
                  )}
                  <div className="mb-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getPriorityColor(item.priority)}`}>
                        {getPriorityLabel(item.priority)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.itemSet} • #{item.itemCollectorNumber}
                    </div>
                    <div className="text-base font-medium">{item.itemName}</div>
                    <div className="mt-2 text-sm text-gray-600">
                      Qty: {item.quantity} • Min: {item.minCondition}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Languages: {item.languageOk.map(l => l.toUpperCase()).join(', ')}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Finishes: {item.finishOk.join(', ')}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEditModal(item)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleDeleteItem(item.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Add Want Modal */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false)
            resetForm()
          }}
          title="Add Item to Want List"
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Note: Full card selection will be available once the backend API is implemented.
                For now, you can test the form structure.
              </p>
              <Input
                label="Card ID"
                type="text"
                value={formData.itemId}
                onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                placeholder="Card ID (will be replaced with search)"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
              />
              <Select
                label="Minimum Condition"
                value={formData.minCondition}
                onChange={(e) => setFormData({ ...formData, minCondition: e.target.value as any })}
              >
                <option value="NM">Near Mint</option>
                <option value="LP">Lightly Played</option>
                <option value="MP">Moderately Played</option>
                <option value="HP">Heavily Played</option>
              </Select>
            </div>
            <div>
              <Select
                label="Priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) as 1 | 2 | 3 })}
              >
                <option value="1">Must Have</option>
                <option value="2">Want</option>
                <option value="3">Nice to Have</option>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Accepted Languages</label>
              <div className="flex flex-wrap gap-2">
                {['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'ru', 'zhs'].map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleLanguage(lang)}
                    className={`rounded-md px-3 py-1 text-sm border transition-colors ${
                      formData.languageOk.includes(lang)
                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Accepted Finishes</label>
              <div className="flex flex-wrap gap-2">
                {(['normal', 'foil', 'etched', 'showcase'] as const).map(finish => (
                  <button
                    key={finish}
                    type="button"
                    onClick={() => toggleFinish(finish)}
                    className={`rounded-md px-3 py-1 text-sm border transition-colors capitalize ${
                      formData.finishOk.includes(finish)
                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {finish}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddModalOpen(false)
                  resetForm()
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddItem}>Add Want</Button>
            </div>
          </div>
        </Modal>

        {/* Edit Want Modal */}
        <Modal
          isOpen={!!editingItem}
          onClose={() => {
            setEditingItem(null)
            resetForm()
          }}
          title="Edit Want List Item"
          size="lg"
        >
          {editingItem && (
            <div className="space-y-4">
              <div className="mb-4 rounded-md bg-gray-50 p-3">
                <p className="text-sm font-medium">{editingItem.itemName}</p>
                <p className="text-xs text-gray-500">
                  {editingItem.itemSet} • #{editingItem.itemCollectorNumber}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                />
                <Select
                  label="Minimum Condition"
                  value={formData.minCondition}
                  onChange={(e) => setFormData({ ...formData, minCondition: e.target.value as any })}
                >
                  <option value="NM">Near Mint</option>
                  <option value="LP">Lightly Played</option>
                  <option value="MP">Moderately Played</option>
                  <option value="HP">Heavily Played</option>
                </Select>
              </div>
              <div>
                <Select
                  label="Priority"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) as 1 | 2 | 3 })}
                >
                  <option value="1">Must Have</option>
                  <option value="2">Want</option>
                  <option value="3">Nice to Have</option>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Accepted Languages</label>
                <div className="flex flex-wrap gap-2">
                  {['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'ru', 'zhs'].map(lang => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => toggleLanguage(lang)}
                      className={`rounded-md px-3 py-1 text-sm border transition-colors ${
                        formData.languageOk.includes(lang)
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {lang.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Accepted Finishes</label>
                <div className="flex flex-wrap gap-2">
                  {(['normal', 'foil', 'etched', 'showcase'] as const).map(finish => (
                    <button
                      key={finish}
                      type="button"
                      onClick={() => toggleFinish(finish)}
                      className={`rounded-md px-3 py-1 text-sm border transition-colors capitalize ${
                        formData.finishOk.includes(finish)
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {finish}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingItem(null)
                    resetForm()
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleUpdateItem}>Save Changes</Button>
              </div>
            </div>
          )}
        </Modal>
      </main>
    </ProtectedRoute>
  )
}

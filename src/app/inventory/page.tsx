'use client'

import { useEffect, useState, useRef } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Card, CardContent } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'

interface InventoryItem {
  id: string
  itemId: string
  itemName: string
  itemSet: string
  itemCollectorNumber: string
  itemImageUrl?: string
  quantity: number
  condition: 'NM' | 'LP' | 'MP' | 'HP'
  language: string
  finish: 'normal' | 'foil' | 'etched' | 'showcase'
  tradable: boolean
}

interface InventoryFormData {
  itemId: string
  quantity: number
  condition: 'NM' | 'LP' | 'MP' | 'HP'
  language: string
  finish: 'normal' | 'foil' | 'etched' | 'showcase'
  tradable: boolean
}

export default function InventoryPage() {
  const { user } = useAuth()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [formData, setFormData] = useState<InventoryFormData>({
    itemId: '',
    quantity: 1,
    condition: 'NM',
    language: 'en',
    finish: 'normal',
    tradable: true,
  })

  // Autocomplete/search for cards when adding an item
  const [cardQuery, setCardQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedCard, setSelectedCard] = useState<any | null>(null)
  const fetchAbortRef = useRef<AbortController | null>(null)

  // Fetch card search results when user types
  useEffect(() => {
    const q = cardQuery.trim()
    if (q.length < 2) {
      setSearchResults([])
      setSearchError(null)
      setSearchLoading(false)
      return
    }

    const handle = setTimeout(async () => {
      try {
        setSearchLoading(true)
        setSearchError(null)

        // Abort any in-flight request
        if (fetchAbortRef.current) fetchAbortRef.current.abort()
        const controller = new AbortController()
        fetchAbortRef.current = controller

        const params = new URLSearchParams({ q, limit: '8', page: '1' })
        let res = await fetch(`/api/cards/search?${params.toString()}`, { signal: controller.signal })
        let data = await res.json()
        if (!res.ok || !Array.isArray(data?.data) || data.data.length === 0) {
          // Fallback to Scryfall
          const sfRes = await fetch(`/api/scryfall?${params.toString()}`, { signal: controller.signal })
          if (!sfRes.ok) {
            const text = await sfRes.text().catch(() => '')
            throw new Error(text || 'Failed to fetch')
          }
          data = await sfRes.json()
        }

        const items = (data?.data ?? [])
        setSearchResults(items)
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return
        console.error('Search error', e)
        setSearchError('Unable to fetch results')
      } finally {
        setSearchLoading(false)
      }
    }, 300)

    return () => clearTimeout(handle)
  }, [cardQuery])

  // Fetch inventory items
  useEffect(() => {
    if (!user) return

    const fetchInventory = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await fetch('/api/inventory')
        
        if (!response.ok) {
          // If API doesn't exist yet, show empty state
          if (response.status === 404) {
            setInventory([])
            return
          }
          throw new Error('Failed to fetch inventory')
        }

        const data = await response.json()
        setInventory(data.data || [])
      } catch (err) {
        // Gracefully handle missing API - show empty state
        console.warn('Inventory API not available yet:', err)
        setInventory([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchInventory()
  }, [user])

  const handleAddItem = async () => {
    if (!formData.itemId) {
      setError('Please select a card')
      return
    }

    try {
      setError(null)
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add item')
      }

      const newItem = await response.json()
      setInventory([...inventory, newItem])
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
      const response = await fetch(`/api/inventory/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update item')
      }

      const updatedItem = await response.json()
      setInventory(inventory.map(item => item.id === updatedItem.id ? updatedItem : item))
      setEditingItem(null)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item')
    }
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to remove this item from your inventory?')) {
      return
    }

    try {
      setError(null)
      const response = await fetch(`/api/inventory/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete item')
      }

      setInventory(inventory.filter(item => item.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item')
    }
  }

  const resetForm = () => {
    setFormData({
      itemId: '',
      quantity: 1,
      condition: 'NM',
      language: 'en',
      finish: 'normal',
      tradable: true,
    })
    setCardQuery('')
    setSearchResults([])
    setSelectedCard(null)
  }

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item)
    setFormData({
      itemId: item.itemId,
      quantity: item.quantity,
      condition: item.condition,
      language: item.language,
      finish: item.finish,
      tradable: item.tradable,
    })
  }

  const filteredInventory = inventory.filter(item =>
    item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.itemSet.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <ProtectedRoute>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Inventory</h1>
            <p className="mt-2 text-sm text-gray-500">
              Manage your personal card inventory.
            </p>
          </div>
          <Button onClick={() => setIsAddModalOpen(true)}>Add Item</Button>
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

        {/* Inventory List */}
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
          ) : filteredInventory.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500 mb-4">
                  {searchQuery ? 'No items found matching your search.' : 'Your inventory is empty.'}
                </p>
                <Button onClick={() => setIsAddModalOpen(true)}>
                  Add Your First Item
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredInventory.map((item) => (
                <Card key={item.id}>
                  {item.itemImageUrl && (
                    <img
                      src={item.itemImageUrl}
                      alt={item.itemName}
                      className="mb-3 h-40 w-full rounded-md object-contain bg-gray-50"
                    />
                  )}
                  <div className="mb-3">
                    <div className="text-sm text-gray-500">
                      {item.itemSet} • #{item.itemCollectorNumber}
                    </div>
                    <div className="text-base font-medium">{item.itemName}</div>
                    <div className="mt-2 text-sm text-gray-600">
                      Qty: {item.quantity} • {item.condition} • {item.finish}
                      {item.language !== 'en' && ` • ${item.language.toUpperCase()}`}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {item.tradable ? (
                        <span className="text-green-600">✓ Tradable</span>
                      ) : (
                        <span className="text-gray-400">Not tradable</span>
                      )}
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

        {/* Add Item Modal */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false)
            resetForm()
          }}
          title="Add Item to Inventory"
          size="md"
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Note: Full card selection will be available once the backend API is implemented.
                For now, you can test the form structure.
              </p>
              <div>
                <label className="text-sm font-medium">Search card</label>
                <Input
                  type="text"
                  value={cardQuery}
                  onChange={(e) => {
                    setCardQuery(e.target.value)
                    // clear selected card if user edits
                    setSelectedCard(null)
                    setFormData({ ...formData, itemId: '' })
                  }}
                  placeholder="Type card name or collector number..."
                />

                {/* Dropdown results */}
                {cardQuery.trim().length >= 2 && (
                  <div className="mt-2 max-h-64 overflow-auto rounded-md border bg-white shadow-sm">
                    {searchLoading ? (
                      <div className="p-3 text-sm text-gray-500">Searching...</div>
                    ) : searchError ? (
                      <div className="p-3 text-sm text-red-600">{searchError}</div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500">No results</div>
                    ) : (
                      searchResults.map((card) => (
                        <div
                          key={card.id}
                          className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50"
                          onClick={() => {
                            setSelectedCard(card)
                            setFormData({ ...formData, itemId: card.id })
                            // clear query to hide dropdown and avoid refetch
                            setCardQuery('')
                            setSearchResults([])
                          }}
                        >
                          {card.image_uris?.small ? (
                            <img src={card.image_uris.small} alt={card.name} className="h-10 w-8 object-contain" />
                          ) : (
                            <div className="h-10 w-8 bg-gray-100" />
                          )}
                          <div className="flex-1 text-sm">
                            <div className="font-medium">{card.name}</div>
                            <div className="text-xs text-gray-500">{card.set} • #{card.collector_number}</div>
                          </div>
                          <div className="text-xs text-gray-400">Select</div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Selected card preview */}
                {selectedCard && (
                  <div className="mt-3 rounded-md bg-gray-50 p-3">
                    <div className="text-sm font-medium">Selected</div>
                    <div className="text-xs text-gray-600">{selectedCard.name} • {selectedCard.set} #{selectedCard.collector_number}</div>
                  </div>
                )}
              </div>
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
                label="Condition"
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value as any })}
              >
                <option value="NM">Near Mint</option>
                <option value="LP">Lightly Played</option>
                <option value="MP">Moderately Played</option>
                <option value="HP">Heavily Played</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Language"
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="ru">Russian</option>
                <option value="zhs">Simplified Chinese</option>
              </Select>
              <Select
                label="Finish"
                value={formData.finish}
                onChange={(e) => setFormData({ ...formData, finish: e.target.value as any })}
              >
                <option value="normal">Normal</option>
                <option value="foil">Foil</option>
                <option value="etched">Etched</option>
                <option value="showcase">Showcase</option>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="tradable"
                checked={formData.tradable}
                onChange={(e) => setFormData({ ...formData, tradable: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="tradable" className="text-sm font-medium">
                Mark as tradable
              </label>
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
              <Button onClick={handleAddItem}>Add Item</Button>
            </div>
          </div>
        </Modal>

        {/* Edit Item Modal */}
        <Modal
          isOpen={!!editingItem}
          onClose={() => {
            setEditingItem(null)
            resetForm()
          }}
          title="Edit Inventory Item"
          size="md"
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
                  label="Condition"
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value as any })}
                >
                  <option value="NM">Near Mint</option>
                  <option value="LP">Lightly Played</option>
                  <option value="MP">Moderately Played</option>
                  <option value="HP">Heavily Played</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Language"
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                  <option value="ru">Russian</option>
                  <option value="zhs">Simplified Chinese</option>
                </Select>
                <Select
                  label="Finish"
                  value={formData.finish}
                  onChange={(e) => setFormData({ ...formData, finish: e.target.value as any })}
                >
                  <option value="normal">Normal</option>
                  <option value="foil">Foil</option>
                  <option value="etched">Etched</option>
                  <option value="showcase">Showcase</option>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-tradable"
                  checked={formData.tradable}
                  onChange={(e) => setFormData({ ...formData, tradable: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="edit-tradable" className="text-sm font-medium">
                  Mark as tradable
                </label>
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

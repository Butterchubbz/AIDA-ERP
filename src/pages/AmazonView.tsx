import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { pb } from '../lib/pocketbase';
import { COLLECTIONS } from '../lib/collections';
import { useAmazonPOs } from '../hooks/useShippingModules';
import type { AmazonListing, AmazonListingVariant } from '../types/amazon';

const AMAZON_LISTINGS_KEY = 'aida_amazon_listings';

function loadListings(): AmazonListing[] {
  try {
    const raw = localStorage.getItem(AMAZON_LISTINGS_KEY);
    return raw ? (JSON.parse(raw) as AmazonListing[]) : [];
  } catch {
    return [];
  }
}

function saveListings(listings: AmazonListing[]): void {
  localStorage.setItem(AMAZON_LISTINGS_KEY, JSON.stringify(listings));
}

function getParentSku(sku: string): string {
  const parts = sku.split('-');
  if (parts.length <= 1) return sku;
  return parts.slice(0, parts.length - 1).join('-');
}

interface InventoryOption {
  id: string;
  name: string;
  sku: string;
}

interface AddListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (listing: AmazonListing) => void;
}

function AddListingModal({ isOpen, onClose, onAdd }: AddListingModalProps) {
  const [step, setStep] = useState(1);
  const [itemType, setItemType] = useState<'Device' | 'Component'>('Device');
  const [inventoryOptions, setInventoryOptions] = useState<InventoryOption[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryOption | null>(null);
  const [isMultiSku, setIsMultiSku] = useState<boolean | null>(null);
  const [singleAsin, setSingleAsin] = useState('');
  const [parentSku, setParentSku] = useState('');
  const [variants, setVariants] = useState<AmazonListingVariant[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const collection =
      itemType === 'Device' ? COLLECTIONS.INVENTORY_DEVICE : COLLECTIONS.INVENTORY_COMPONENT;
    setLoadingItems(true);
    pb.collection(collection)
      .getFullList({ fields: 'id,name,sku' })
      .then(records => {
        setInventoryOptions(
          records.map(r => ({
            id: String(r.id),
            name: String((r as Record<string, unknown>).name ?? ''),
            sku: String((r as Record<string, unknown>).sku ?? ''),
          }))
        );
      })
      .catch(console.error)
      .finally(() => setLoadingItems(false));
  }, [isOpen, itemType]);

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setItemType('Device');
      setSelectedItem(null);
      setIsMultiSku(null);
      setSingleAsin('');
      setParentSku('');
      setVariants([]);
    }
  }, [isOpen]);

  const handleSelectItem = (id: string) => {
    const item = inventoryOptions.find(o => o.id === id) ?? null;
    setSelectedItem(item);
    if (item) setParentSku(getParentSku(item.sku));
  };

  const addVariant = () => {
    setVariants(prev => [...prev, { suffix: '', asin: '', packSize: 1, price: 0 }]);
  };

  const updateVariant = (
    index: number,
    field: keyof AmazonListingVariant,
    value: string | number
  ) => {
    setVariants(prev => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  };

  const removeVariant = (index: number) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (!selectedItem) return;
    const listing: AmazonListing = {
      id: `listing_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      itemType,
      inventoryId: selectedItem.id,
      productName: selectedItem.name,
      inventorySku: selectedItem.sku,
      parentSku: isMultiSku ? parentSku : selectedItem.sku,
      isMultiSku: isMultiSku ?? false,
      asin: isMultiSku ? undefined : singleAsin,
      variants: isMultiSku ? variants : undefined,
      fbaStock: 0,
    };
    onAdd(listing);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg p-6 text-slate-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-cyan-400">
            Add Listing — Step {step} of 4
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <i className="fas fa-times text-xl" />
          </button>
        </div>

        {/* Step 1: Select type */}
        {step === 1 && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Item Type</label>
            <select
              value={itemType}
              onChange={e => setItemType(e.target.value as 'Device' | 'Component')}
              className="w-full bg-slate-700 rounded-md px-3 py-2 text-slate-100 border border-slate-600"
            >
              <option value="Device">Device</option>
              <option value="Component">Component</option>
            </select>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Select item */}
        {step === 2 && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Select Item</label>
            {loadingItems ? (
              <p className="text-slate-400 py-4 text-center">Loading...</p>
            ) : (
              <select
                value={selectedItem?.id ?? ''}
                onChange={e => handleSelectItem(e.target.value)}
                className="w-full bg-slate-700 rounded-md px-3 py-2 text-slate-100 border border-slate-600"
              >
                <option value="">— select item —</option>
                {inventoryOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name} ({opt.sku})
                  </option>
                ))}
              </select>
            )}
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-md"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!selectedItem}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: SKU grouping */}
        {step === 3 && selectedItem && (
          <div>
            <p className="text-slate-300 mb-4">
              Does{' '}
              <span className="text-cyan-300 font-semibold">{selectedItem.name}</span>{' '}
              have multiple Amazon SKUs?
            </p>
            {isMultiSku === null && (
              <div className="flex gap-4">
                <button
                  onClick={() => setIsMultiSku(true)}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg border border-slate-600 font-semibold"
                >
                  Yes
                </button>
                <button
                  onClick={() => setIsMultiSku(false)}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg border border-slate-600 font-semibold"
                >
                  No — single SKU
                </button>
              </div>
            )}
            {isMultiSku === false && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  ASIN / SKU
                </label>
                <input
                  type="text"
                  value={singleAsin}
                  onChange={e => setSingleAsin(e.target.value)}
                  className="w-full bg-slate-700 rounded-md px-3 py-2 text-slate-100 border border-slate-600"
                  placeholder="e.g. B0XXXXXXXXX"
                />
              </div>
            )}
            {isMultiSku === true && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Parent SKU
                </label>
                <input
                  type="text"
                  value={parentSku}
                  onChange={e => setParentSku(e.target.value)}
                  className="w-full bg-slate-700 rounded-md px-3 py-2 text-slate-100 border border-slate-600 mb-4"
                />
                <p className="text-sm text-slate-400 mb-3">Variants:</p>
                <div className="grid grid-cols-5 gap-2 mb-1 text-xs text-slate-500 font-medium px-1">
                  <span>Suffix</span><span>ASIN</span><span>Pack</span><span>Price</span><span />
                </div>
                {variants.map((v, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2 mb-2 items-center">
                    <input
                      type="text"
                      placeholder="-0, -250"
                      value={v.suffix}
                      onChange={e => updateVariant(i, 'suffix', e.target.value)}
                      className="bg-slate-700 rounded px-2 py-1 text-sm border border-slate-600 text-slate-100"
                    />
                    <input
                      type="text"
                      placeholder="ASIN"
                      value={v.asin}
                      onChange={e => updateVariant(i, 'asin', e.target.value)}
                      className="bg-slate-700 rounded px-2 py-1 text-sm border border-slate-600 text-slate-100"
                    />
                    <input
                      type="number"
                      placeholder="Pack"
                      value={v.packSize}
                      onChange={e => updateVariant(i, 'packSize', Number(e.target.value))}
                      className="bg-slate-700 rounded px-2 py-1 text-sm border border-slate-600 text-slate-100"
                      min={1}
                    />
                    <input
                      type="number"
                      placeholder="Price"
                      value={v.price}
                      onChange={e => updateVariant(i, 'price', Number(e.target.value))}
                      className="bg-slate-700 rounded px-2 py-1 text-sm border border-slate-600 text-slate-100"
                      min={0}
                      step={0.01}
                    />
                    <button
                      onClick={() => removeVariant(i)}
                      className="text-red-400 hover:text-red-300 text-sm flex justify-center"
                    >
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addVariant}
                  className="mt-2 text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <i className="fas fa-plus" /> Add variant
                </button>
              </div>
            )}
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => {
                  setIsMultiSku(null);
                  setStep(2);
                }}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-md"
              >
                Back
              </button>
              {isMultiSku !== null && (
                <button
                  onClick={() => setStep(4)}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        )}

        {/* Debug: variant state */}
        <pre className="text-xs text-slate-400 mt-3 bg-slate-900/50 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
          {JSON.stringify(variants, null, 2)}
        </pre>

        {/* Step 4: Confirm */}
        {step === 4 && selectedItem && (
          <div>
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Confirm Listing</h3>
            <dl className="space-y-2 text-sm bg-slate-700/50 rounded-lg p-4">
              <div className="flex gap-2">
                <dt className="text-slate-400 w-32">Product:</dt>
                <dd className="text-slate-200">{selectedItem.name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-400 w-32">Type:</dt>
                <dd className="text-slate-200">{itemType}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-400 w-32">Inventory SKU:</dt>
                <dd className="text-slate-200 font-mono">{selectedItem.sku}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-400 w-32">Parent SKU:</dt>
                <dd className="text-slate-200 font-mono">
                  {isMultiSku ? parentSku : selectedItem.sku}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-400 w-32">Variants:</dt>
                <dd className="text-slate-200">
                  {isMultiSku
                    ? `${variants.length} variant(s)`
                    : `Single SKU${singleAsin ? ` (${singleAsin})` : ''}`}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-md"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md font-semibold flex items-center gap-2"
              >
                <i className="fas fa-check" />
                Add Listing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ChartRow {
  sku: string;
  stock: number;
  inbound: number;
}

// ---------------------------------------------------------------------------
// ManageListingModal — edit metadata + delete (with confirmation)
// ---------------------------------------------------------------------------
interface ManageListingModalProps {
  isOpen: boolean;
  group: { parentSku: string; items: AmazonListing[] } | null;
  onClose: () => void;
  onSave: (updated: AmazonListing[]) => void;
  onDelete: (ids: string[]) => void;
}

function ManageListingModal({
  isOpen,
  group,
  onClose,
  onSave,
  onDelete,
}: ManageListingModalProps) {
  const [editedItems, setEditedItems] = useState<AmazonListing[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (group) setEditedItems(group.items.map(i => ({ ...i })));
    setConfirmDelete(false);
  }, [group]);

  if (!isOpen || !group) return null;

  const updateVariantField = (
    listingId: string,
    variantIndex: number,
    field: keyof AmazonListingVariant,
    value: string | number
  ) => {
    setEditedItems(prev =>
      prev.map(l => {
        if (l.id !== listingId) return l;
        const variants = (l.variants ?? []).map((v, i) =>
          i === variantIndex ? { ...v, [field]: value } : v
        );
        return { ...l, variants };
      })
    );
  };

  const updateAsin = (listingId: string, asin: string) => {
    setEditedItems(prev =>
      prev.map(l => (l.id !== listingId ? l : { ...l, asin }))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-xl font-semibold text-cyan-400">Manage Listing</h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{group.parentSku}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <i className="fas fa-times text-xl" />
          </button>
        </div>

        {editedItems.map(listing => (
          <div key={listing.id} className="mb-6 bg-slate-700/50 rounded-lg p-4">
            <p className="text-sm font-semibold text-slate-200 mb-3">
              {listing.productName}
              <span className="ml-2 text-xs font-mono text-slate-400">{listing.inventorySku}</span>
            </p>
            {!listing.isMultiSku ? (
              <div>
                <label className="block text-xs text-slate-400 mb-1">ASIN</label>
                <input
                  type="text"
                  value={listing.asin ?? ''}
                  onChange={e => updateAsin(listing.id, e.target.value)}
                  className="w-full bg-slate-700 rounded px-3 py-1.5 text-sm border border-slate-600 text-slate-100"
                  placeholder="B0XXXXXXXXX"
                />
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-400 mb-2">Variants</p>
                <div className="grid grid-cols-4 gap-2 mb-1 text-xs text-slate-500 font-medium">
                  <span>Suffix</span><span>ASIN</span><span>Pack</span><span>Price</span>
                </div>
                {(listing.variants ?? []).map((v, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                    <input
                      type="text"
                      value={v.suffix}
                      onChange={e => updateVariantField(listing.id, i, 'suffix', e.target.value)}
                      className="bg-slate-700 rounded px-2 py-1 text-xs border border-slate-600 text-slate-100"
                    />
                    <input
                      type="text"
                      value={v.asin}
                      onChange={e => updateVariantField(listing.id, i, 'asin', e.target.value)}
                      className="bg-slate-700 rounded px-2 py-1 text-xs border border-slate-600 text-slate-100"
                    />
                    <input
                      type="number"
                      value={v.packSize}
                      onChange={e => updateVariantField(listing.id, i, 'packSize', Number(e.target.value))}
                      className="bg-slate-700 rounded px-2 py-1 text-xs border border-slate-600 text-slate-100"
                      min={1}
                    />
                    <input
                      type="number"
                      value={v.price}
                      onChange={e => updateVariantField(listing.id, i, 'price', Number(e.target.value))}
                      className="bg-slate-700 rounded px-2 py-1 text-xs border border-slate-600 text-slate-100"
                      min={0}
                      step={0.01}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Delete section */}
        {!confirmDelete ? (
          <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-red-400 hover:text-red-300 text-sm flex items-center gap-2 px-3 py-1.5 rounded border border-red-700/30 hover:bg-red-700/20 transition-colors"
            >
              <i className="fas fa-trash text-xs" /> Delete Listing
            </button>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-md text-sm">
                Cancel
              </button>
              <button
                onClick={() => { onSave(editedItems); onClose(); }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md text-sm font-semibold"
              >
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 pt-4 border-t border-red-900/40 bg-red-900/10 rounded-lg p-4">
            <p className="text-sm font-semibold text-red-400 mb-1">Delete Amazon Listing?</p>
            <p className="text-xs text-slate-400 mb-4">
              This will remove all variants under{' '}
              <span className="font-mono text-slate-300">{group.parentSku}</span> from the
              Amazon Overview. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-md text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(group.items.map(l => l.id));
                  onClose();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-sm font-semibold"
              >
                Delete Listing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdjustStockModal — update fbaStock per variant (no metadata changes)
// ---------------------------------------------------------------------------
interface StockDraft {
  id: string;
  sku: string;
  currentStock: number;
  newStock: number;
}

interface AdjustStockModalProps {
  isOpen: boolean;
  group: { parentSku: string; items: AmazonListing[] } | null;
  onClose: () => void;
  onSave: (updates: { id: string; fbaStock: number }[], reason: string) => void;
}

function AdjustStockModal({ isOpen, group, onClose, onSave }: AdjustStockModalProps) {
  const [drafts, setDrafts] = useState<StockDraft[]>([]);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (group) {
      setDrafts(
        group.items.map(l => ({
          id: l.id,
          sku: l.inventorySku,
          currentStock: l.fbaStock,
          newStock: l.fbaStock,
        }))
      );
    }
    setReason('');
  }, [group]);

  if (!isOpen || !group) return null;

  const updateDraft = (id: string, val: number) => {
    setDrafts(prev => prev.map(d => (d.id === id ? { ...d, newStock: val } : d)));
  };

  const handleSave = () => {
    onSave(
      drafts.map(d => ({ id: d.id, fbaStock: d.newStock })),
      reason
    );
    onClose();
  };

  const hasChanges = drafts.some(d => d.newStock !== d.currentStock);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 text-slate-100">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-xl font-semibold text-cyan-400">Adjust FBA Stock</h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{group.parentSku}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <i className="fas fa-times text-xl" />
          </button>
        </div>

        <div className="space-y-3 mb-5">
          {drafts.map(d => (
            <div key={d.id} className="bg-slate-700/50 rounded-lg p-3">
              <p className="text-xs font-mono text-slate-400 mb-2">{d.sku}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Current Stock</label>
                  <div className="bg-slate-700 rounded px-3 py-1.5 text-sm text-slate-400 border border-slate-600">
                    {d.currentStock}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">New Stock</label>
                  <input
                    type="number"
                    value={d.newStock}
                    onChange={e => updateDraft(d.id, Math.max(0, Number(e.target.value)))}
                    min={0}
                    className="w-full bg-slate-700 rounded px-3 py-1.5 text-sm border border-slate-600 text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-5">
          <label className="block text-xs text-slate-400 mb-1">Reason (optional)</label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. FBA inventory reconciliation"
            className="w-full bg-slate-700 rounded px-3 py-1.5 text-sm border border-slate-600 text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-md text-sm">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save Stock
          </button>
        </div>
      </div>
    </div>
  );
}

function AmazonView() {
  const [listings, setListings] = useState<AmazonListing[]>(loadListings);
  const [showAddModal, setShowAddModal] = useState(false);
  const [manageGroup, setManageGroup] = useState<{ parentSku: string; items: AmazonListing[] } | null>(null);
  const [adjustGroup, setAdjustGroup] = useState<{ parentSku: string; items: AmazonListing[] } | null>(null);
  const { purchaseOrders } = useAmazonPOs();

  // (reserved for future warehouse stock display)
  const [, setStockMap] = useState<Record<string, number>>({});

  // Fetch total warehouse/counted stock for each listing from PocketBase
  useEffect(() => {
    if (listings.length === 0) return;
    const fetchStocks = async () => {
      const map: Record<string, number> = {};
      for (const listing of listings) {
        try {
          const collection =
            listing.itemType === 'Device'
              ? COLLECTIONS.INVENTORY_DEVICE
              : COLLECTIONS.INVENTORY_COMPONENT;
          const field = listing.itemType === 'Device' ? 'warehouseStock' : 'countedStock';
          const record = await pb
            .collection(collection)
            .getOne(listing.inventoryId, { fields: `id,${field}` });
          map[listing.id] = Number(
            (record as unknown as Record<string, unknown>)[field] ?? 0
          );
        } catch {
          map[listing.id] = 0;
        }
      }
      setStockMap(map);
    };
    fetchStocks().catch(console.error);
  }, [listings]);

  // Compute inbound FBA per listing from POs that have been moved to outgoing
  const inboundMap = useMemo(() => {
    const map: Record<string, number> = {};
    const inboundPOs = purchaseOrders.filter(
      po =>
        (po.status === 'Shipped' || po.status === 'Delivered') && po.movedToOutgoing === true
    );
    for (const po of inboundPOs) {
      for (const item of po.items) {
        for (const listing of listings) {
          if (
            item.sku === listing.inventorySku ||
            item.sku.startsWith(listing.parentSku + '-') ||
            item.sku === listing.parentSku
          ) {
            map[listing.id] = (map[listing.id] ?? 0) + item.quantity;
          }
        }
      }
    }
    return map;
  }, [purchaseOrders, listings]);

  // Group listings by parentSku
  const groups = useMemo(() => {
    const map: Record<string, AmazonListing[]> = {};
    for (const listing of listings) {
      if (!map[listing.parentSku]) map[listing.parentSku] = [];
      map[listing.parentSku].push(listing);
    }
    return Object.entries(map).map(([parentSku, items]) => ({ parentSku, items }));
  }, [listings]);

  // Summary totals
  const totalFbaStock = listings.reduce((sum, l) => sum + l.fbaStock, 0);
  const totalInbound = listings.reduce((sum, l) => sum + (inboundMap[l.id] ?? 0), 0);

  const handleAddListing = (listing: AmazonListing) => {
    const updated = [...listings, listing];
    setListings(updated);
    saveListings(updated);
  };

  const handleSaveManage = (updatedItems: AmazonListing[]) => {
    const ids = new Set(updatedItems.map(l => l.id));
    const updated = listings.map(l => {
      const edit = updatedItems.find(u => u.id === l.id);
      return ids.has(l.id) && edit ? edit : l;
    });
    setListings(updated);
    saveListings(updated);
  };

  const handleDeleteGroup = (ids: string[]) => {
    const idSet = new Set(ids);
    const updated = listings.filter(l => !idSet.has(l.id));
    setListings(updated);
    saveListings(updated);
  };

  const handleAdjustStock = (updates: { id: string; fbaStock: number }[], _reason: string) => {
    const map = new Map(updates.map(u => [u.id, u.fbaStock]));
    const updated = listings.map(l =>
      map.has(l.id) ? { ...l, fbaStock: map.get(l.id)! } : l
    );
    setListings(updated);
    saveListings(updated);
  };

  return (
    <section className="bg-slate-800 p-6 rounded-xl shadow-lg w-full text-slate-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-cyan-400">Amazon FBA Overview</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md font-semibold text-white flex items-center gap-2"
        >
          <i className="fas fa-plus" />
          Add Listing
        </button>
      </div>

      {listings.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <i className="fas fa-box-open text-4xl mb-4 block" />
          <p className="text-lg">No Amazon listings yet.</p>
          <p className="text-sm">Click "Add Listing" to begin.</p>
        </div>
      ) : (
        <>
          {/* Summary stats row */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Listings Added', value: listings.length, color: 'text-slate-200' },
              { label: 'Total SKUs', value: listings.length, color: 'text-slate-200' },
              { label: 'Total FBA Stock', value: totalFbaStock, color: 'text-cyan-400' },
              { label: 'Total Inbound', value: totalInbound > 0 ? `+${totalInbound}` : '0', color: 'text-yellow-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-slate-700/60 rounded-lg px-4 py-3 text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Groups */}
          {groups.map(group => {
            const data: ChartRow[] = group.items.map(l => ({
              sku: l.inventorySku,
              stock: l.fbaStock,
              inbound: inboundMap[l.id] ?? 0,
            }));
            const groupTotalStock = group.items.reduce((s, l) => s + l.fbaStock, 0);
            const groupTotalInbound = group.items.reduce(
              (s, l) => s + (inboundMap[l.id] ?? 0), 0
            );
            const chartHeight = Math.max(group.items.length * 48, 48);

            return (
              <div key={group.parentSku} className="mb-8">
                {/* Group header */}
                <div className="flex items-center justify-between mb-2 mt-4 border-b border-slate-700 pb-1">
                  <div className="text-sm font-bold text-slate-300">
                    {group.parentSku}
                    <span className="text-xs text-slate-500 ml-2 font-normal">
                      {group.items.length} variant{group.items.length !== 1 ? 's' : ''}
                      {' · '}{groupTotalStock} in stock
                      {groupTotalInbound > 0 && ` · +${groupTotalInbound} inbound`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAdjustGroup(group)}
                      className="px-3 py-1 text-xs rounded border border-slate-600 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-slate-100 transition-colors flex items-center gap-1"
                    >
                      <i className="fas fa-sliders-h text-xs" /> Adjust Stock
                    </button>
                    <button
                      onClick={() => setManageGroup(group)}
                      className="px-3 py-1 text-xs rounded border border-cyan-700/50 bg-cyan-900/20 hover:bg-cyan-900/40 text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                    >
                      <i className="fas fa-cog text-xs" /> Manage Listing
                    </button>
                  </div>
                </div>

                {/* Bar chart — read-only visualization */}
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart
                    layout="vertical"
                    data={data}
                    margin={{ top: 0, right: 60, bottom: 0, left: 120 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="sku"
                      width={120}
                      tick={{ fontSize: 12, fontFamily: 'monospace', fill: '#94a3b8' }}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        value,
                        name === 'stock' ? 'FBA Stock' : 'Inbound',
                      ]}
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #475569',
                        borderRadius: '6px',
                        color: '#e2e8f0',
                      }}
                    />
                    <Bar dataKey="stock" stackId="a" fill="#06b6d4" radius={[0, 0, 0, 0]}>
                      <LabelList
                        dataKey="stock"
                        position="right"
                        style={{ fill: '#06b6d4', fontSize: 12 }}
                      />
                    </Bar>
                    <Bar
                      dataKey="inbound"
                      stackId="a"
                      fill="#475569"
                      fillOpacity={0.6}
                      radius={[0, 4, 4, 0]}
                    >
                      <LabelList
                        dataKey="inbound"
                        position="right"
                        formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? `+${v}` : '')}
                        style={{ fill: '#94a3b8', fontSize: 11 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </>
      )}

      <AddListingModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddListing}
      />

      <ManageListingModal
        isOpen={manageGroup !== null}
        group={manageGroup}
        onClose={() => setManageGroup(null)}
        onSave={handleSaveManage}
        onDelete={handleDeleteGroup}
      />

      <AdjustStockModal
        isOpen={adjustGroup !== null}
        group={adjustGroup}
        onClose={() => setAdjustGroup(null)}
        onSave={handleAdjustStock}
      />
    </section>
  );
}

export default AmazonView;

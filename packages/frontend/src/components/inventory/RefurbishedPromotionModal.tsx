import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { COLLECTIONS } from '../../lib/collections';
import type { RMAEntry } from '@aida/shared';
import { createRecord } from '../../lib/pocketbaseApi';
import ModalShell from '../common/ModalShell';
import StatusBadge from '../common/StatusBadge';
import { formatLocalDate } from '../../utils/date';

type CertificationStatus = 'RN' | 'RR' | 'S';

interface RefurbishedPromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  rmaEntry: RMAEntry | null;
}

const certificationMeta: Record<
  CertificationStatus,
  { label: string; badgeClass: string; printColor: string }
> = {
  RN: {
    label: 'Refurbished New',
    badgeClass: 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40',
    printColor: '#065f46',
  },
  RR: {
    label: 'Refurbished Restored',
    badgeClass: 'bg-blue-600/20 text-blue-300 border border-blue-500/40',
    printColor: '#1d4ed8',
  },
  S: {
    label: 'Salvage',
    badgeClass: 'bg-red-600/20 text-red-300 border border-red-500/40',
    printColor: '#b91c1c',
  },
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatCurrency = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const toDateStamp = () => {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

export default function RefurbishedPromotionModal({
  isOpen,
  onClose,
  onSuccess,
  rmaEntry,
}: RefurbishedPromotionModalProps) {
  const [deviceName, setDeviceName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [certificationStatus, setCertificationStatus] = useState<CertificationStatus>('RN');
  const [askingPrice, setAskingPrice] = useState<number>(0);
  const [imeiSerial, setImeiSerial] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !rmaEntry) {
      return;
    }

    setDeviceName(rmaEntry.device || '');
    setFormSku(`RN-${toDateStamp()}`);
    setCertificationStatus('RN');
    setAskingPrice(0);
    setImeiSerial('');
    setNotes('');
    setError(null);
    setIsSubmitting(false);
  }, [isOpen, rmaEntry]);

  const openPrintLabel = (params: {
    certification: CertificationStatus;
    name: string;
    sku: string;
    imei: string;
    price: number;
    dateLabel: string;
    rmaRef: string;
  }) => {
    const cert = certificationMeta[params.certification];
    const popup = window.open('', '_blank', 'width=700,height=520');
    if (!popup) {
      return;
    }

    const html = `<!doctype html>
<html>
  <head>
    <title>Refurbished Label</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
      .label { border: 2px solid #0f172a; border-radius: 12px; padding: 20px; max-width: 620px; }
      .cert { font-size: 42px; font-weight: 800; color: #ffffff; padding: 10px 18px; border-radius: 10px; display: inline-block; background: ${cert.printColor}; }
      .cert-sub { margin-left: 10px; font-size: 16px; color: #334155; font-weight: 700; }
      .title { margin-top: 18px; font-size: 26px; font-weight: 800; }
      .line { margin-top: 10px; font-size: 17px; }
      .muted { color: #475569; }
      .row { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 8px; }
      .cell { min-width: 260px; }
      @media print {
        body { margin: 0; }
        .label { border-width: 3px; }
      }
    </style>
  </head>
  <body>
    <div class="label">
      <div>
        <span class="cert">${escapeHtml(params.certification)}</span>
        <span class="cert-sub">${escapeHtml(cert.label)}</span>
      </div>
      <div class="title">${escapeHtml(params.name)}</div>
      <div class="row">
        <div class="cell line"><strong>SKU:</strong> ${escapeHtml(params.sku)}</div>
        <div class="cell line"><strong>IMEI/Serial:</strong> ${escapeHtml(params.imei || 'N/A')}</div>
      </div>
      <div class="row">
        <div class="cell line"><strong>Asking Price:</strong> ${escapeHtml(formatCurrency(params.price))}</div>
        <div class="cell line"><strong>Date:</strong> ${escapeHtml(params.dateLabel)}</div>
      </div>
      <div class="line muted"><strong>Original RMA:</strong> ${escapeHtml(params.rmaRef)}</div>
    </div>
    <script>
      window.onload = function () {
        window.print();
      };
    </script>
  </body>
</html>`;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  };

  const handleSubmit = async () => {
    if (!rmaEntry) {
      return;
    }

    const normalizedSku = formSku.trim();
    if (!normalizedSku) {
      setError('SKU is required.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const imei = imeiSerial.trim();
      const price = Number.isFinite(askingPrice) ? askingPrice : 0;
      const extraNotes = notes.trim();
      const serializedNotes = `--- Original RMA: ${rmaEntry.id ?? 'N/A'}\nOrder Ref: ${rmaEntry.orderNumber ?? 'N/A'}\nIMEI: ${imei || 'N/A'}\nAsking Price: ${price}\nTicket: ${rmaEntry.ticketNumber || 'N/A'} ---${extraNotes ? `\n${extraNotes}` : ''}`;

      await createRecord(COLLECTIONS.REFURBISHED_DEVICES, {
        name: deviceName.trim() || rmaEntry.device || 'Refurbished Device',
        sku: normalizedSku,
        refurbishedStock: 1,
        notes: serializedNotes,
      });

      onSuccess();

      openPrintLabel({
        certification: certificationStatus,
        name: deviceName.trim() || rmaEntry.device || 'Refurbished Device',
        sku: normalizedSku,
        imei,
        price,
        dateLabel: formatLocalDate(new Date()),
        rmaRef: rmaEntry.id ?? rmaEntry.orderNumber ?? 'N/A',
      });
    } catch (e) {
      console.error('Failed to promote refurbished device:', e);
      setError('Failed to create refurbished record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !rmaEntry) {
    return null;
  }

  return createPortal(
    <ModalShell>
        <h3 className="text-2xl font-semibold text-cyan-300">Promote To Refurbished Inventory</h3>
        <p className="mt-1 text-sm text-slate-400">
          This RMA is ready to complete. Create a refurbished inventory record before finalizing.
        </p>

        <div className="mt-4 grid gap-3 rounded-lg border border-slate-600/60 bg-slate-700/30 p-4 text-sm md:grid-cols-2">
          <div>
            <span className="text-slate-400">Customer:</span>{' '}
            <span className="text-slate-200">{rmaEntry.customerName || 'N/A'}</span>
          </div>
          <div>
            <span className="text-slate-400">Order:</span>{' '}
            <span className="text-slate-200">{rmaEntry.orderNumber || 'N/A'}</span>
          </div>
          <div>
            <span className="text-slate-400">Device:</span>{' '}
            <span className="text-slate-200">{rmaEntry.device || 'N/A'}</span>
          </div>
          <div>
            <span className="text-slate-400">Tracking:</span>{' '}
            <span className="text-slate-200">{rmaEntry.trackingNumber || 'N/A'}</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Device Name</span>
            <input
              value={deviceName}
              onChange={e => setDeviceName(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">
              SKU <span className="text-red-400">*</span>
            </span>
            <input
              value={formSku}
              onChange={e => setFormSku(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              placeholder="RN-SERIALNUMBER-YYYYMMDD"
              required
            />
            <span className="mt-1 block text-xs text-slate-500">Format hint: RN-SERIALNUMBER-YYYYMMDD</span>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Certification Status</span>
            <select
              value={certificationStatus}
              onChange={e => setCertificationStatus(e.target.value as CertificationStatus)}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            >
              <option value="RN">RN - Refurbished New</option>
              <option value="RR">RR - Refurbished Restored</option>
              <option value="S">S - Salvage</option>
            </select>
            <StatusBadge
              className={`mt-2 ${certificationMeta[certificationStatus].badgeClass}`}
              text={`${certificationStatus} - ${certificationMeta[certificationStatus].label}`}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Asking Price</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={askingPrice}
              onChange={e => setAskingPrice(Number(e.target.value || 0))}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm text-slate-300">IMEI/Serial Number</span>
            <input
              value={imeiSerial}
              onChange={e => setImeiSerial(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm text-slate-300">Notes</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Promoting...' : 'Promote & Complete'}
          </button>
        </div>
    </ModalShell>,
    document.body
  );
}

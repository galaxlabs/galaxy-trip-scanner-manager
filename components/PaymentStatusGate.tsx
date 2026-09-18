import React, { useRef, useState } from 'react';
import { FrappeClient } from '../services/frappe';

interface PaymentStatus {
  configured?: boolean;
  allowed?: boolean;
  blocked?: boolean;
  warning?: boolean;
  status?: string;
  message?: string;
  amount_due?: number;
  amount_paid?: number;
  currency?: string;
  due_date?: string;
  grace_until?: string;
  receipt?: string;
}

interface PaymentStatusGateProps {
  status: PaymentStatus | null;
  onStatusChange: (status: PaymentStatus) => void;
  blockedOnly?: boolean;
}

export default function PaymentStatusGate({ status, onStatusChange, blockedOnly = false }: PaymentStatusGateProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  if (!status?.configured) return null;
  if (!status.blocked && !status.warning && !blockedOnly && status.status !== 'Pending' && status.status !== 'Rejected') return null;

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const nextStatus = await FrappeClient.uploadPaymentReceipt(file, note);
      onStatusChange(nextStatus);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const tone = status.blocked ? 'bg-red-50 border-red-100 text-red-800' : 'bg-amber-50 border-amber-100 text-amber-900';
  const title = status.blocked ? 'Account Suspended' : 'Payment Reminder';

  return (
    <section className={`m-4 rounded-[2rem] border p-5 shadow-sm ${tone}`}>
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-70">{title}</p>
        <h2 className="text-lg font-black leading-tight">{status.message}</h2>
        <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
          <div className="rounded-2xl bg-white/70 p-3">
            <p className="opacity-60 uppercase text-[9px] font-black">Pending Dues</p>
            <p>{status.currency || 'SAR'} {Number(status.amount_due || 0).toFixed(2)}</p>
          </div>
          <div className="rounded-2xl bg-white/70 p-3">
            <p className="opacity-60 uppercase text-[9px] font-black">Pay Before</p>
            <p>{status.grace_until || status.due_date || '-'}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Receipt note / transaction reference"
          className="w-full rounded-2xl border border-white/60 bg-white/80 p-3 text-xs font-bold outline-none"
          rows={2}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          className="hidden"
          onChange={(e) => upload(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60"
        >
          {uploading ? 'Uploading Receipt...' : 'Upload Payment Receipt'}
        </button>
        {status.receipt && <p className="text-[10px] font-bold opacity-70">Receipt uploaded. Waiting for admin approval.</p>}
        {error && <p className="text-[10px] font-bold text-red-700">{error}</p>}
      </div>
    </section>
  );
}

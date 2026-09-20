import React, { useRef, useState } from 'react';
import { FrappeClient } from '../services/frappe';

interface PaymentStatus {
  configured?: boolean;
  has_subscription?: boolean;
  allowed?: boolean;
  blocked?: boolean;
  warning?: boolean;
  status?: string;
  message?: string;
  amount_due?: number;
  amount_paid?: number;
  monthly_credits?: number;
  credits_used?: number;
  credit_balance?: number;
  balance_status?: string;
  currency?: string;
  issue_date?: string;
  last_date?: string;
  disable_after?: string;
  days_remaining?: number;
  timezone?: string;
  due_date?: string;
  grace_until?: string;
  receipt?: string;
  subscription_plan?: string;
  company?: string;
  company_vehicle_count?: number;
  plan_options?: Array<{ plan: 'monthly' | 'yearly' | 'more'; label: string; amount?: number | null; credits: number; bulk_eligible?: boolean; bulk_min_vehicles?: number; monthly_rate?: number | null; vehicle_count?: number }>;
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

  if (!status) return null;

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

  const balanceStatus = status.balance_status || (Number(status.credit_balance || 0) <= 0 ? 'Ended' : Number(status.credit_balance || 0) <= 5 ? 'Low' : 'Active');
  const isActive = !status.blocked && balanceStatus !== 'Ended' && balanceStatus !== 'No Plan';
  const tone = isActive ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-red-50 border-red-100 text-red-800';
  const title = status.blocked ? 'Account Suspended' : status.has_subscription ? 'Subscription Wallet' : 'Load Balance';
  const monthlyPlan = status.plan_options?.find((option) => option.plan === 'monthly') || { plan: 'monthly' as const, label: 'Monthly', amount: null, credits: 30 };

  return (
    <section className={`m-4 rounded-[2rem] border p-5 shadow-sm ${tone}`}>
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-70">{title}</p>
        <h2 className="text-lg font-black leading-tight">{status.message}</h2>
        <div className="rounded-3xl bg-white/75 p-4 text-xs font-bold">
          <div className="flex items-center justify-between gap-3">
            <span className="opacity-60 uppercase text-[9px] font-black tracking-widest">Balance Status</span>
            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase text-white ${isActive ? 'bg-emerald-700' : 'bg-red-700'}`}>{balanceStatus}</span>
          </div>
          <p className="mt-1 opacity-70">Account disables after {status.disable_after || status.last_date || '-'} Saudi time.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
          <div className="rounded-2xl bg-white/70 p-3">
            <p className="opacity-60 uppercase text-[9px] font-black">Wallet Credits</p>
            <p>{Number(status.credit_balance ?? 0)} / {Number(status.monthly_credits ?? 30)}</p>
          </div>
          <div className="rounded-2xl bg-white/70 p-3">
            <p className="opacity-60 uppercase text-[9px] font-black">Current Credit Used</p>
            <p>{Number(status.credits_used ?? 0)} credits</p>
          </div>
          <div className="rounded-2xl bg-white/70 p-3">
            <p className="opacity-60 uppercase text-[9px] font-black">Pending Dues</p>
            <p>{status.currency || 'SAR'} {Number(status.amount_due || 0).toFixed(2)}</p>
          </div>
          <div className="rounded-2xl bg-white/70 p-3">
            <p className="opacity-60 uppercase text-[9px] font-black">Issue Date</p>
            <p>{status.issue_date || status.due_date || '-'}</p>
          </div>
          <div className="rounded-2xl bg-white/70 p-3">
            <p className="opacity-60 uppercase text-[9px] font-black">Last Date</p>
            <p>{status.last_date || status.grace_until || '-'}</p>
          </div>
          <div className="rounded-2xl bg-white/70 p-3">
            <p className="opacity-60 uppercase text-[9px] font-black">Saudi Time Zone</p>
            <p>{status.timezone || 'Asia/Riyadh'}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="w-full rounded-2xl bg-emerald-700 px-4 py-4 text-left text-white">
          <span className="block text-xs font-black uppercase tracking-widest">{monthlyPlan.label}</span>
          <span className="mt-1 block text-[11px] font-bold opacity-90">{monthlyPlan.credits} credits</span>
          <span className="mt-1 block text-[11px] font-black">Pricing as per agreement</span>
        </div>
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
          {uploading ? 'Uploading Receipt...' : 'Add Payment / Upload Receipt'}
        </button>
        {status.receipt && <p className="text-[10px] font-bold opacity-70">Receipt uploaded. Waiting for admin approval.</p>}
        {error && <p className="text-[10px] font-bold text-red-700">{error}</p>}
      </div>
    </section>
  );
}

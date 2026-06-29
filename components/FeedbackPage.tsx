import React, { useMemo, useState } from 'react';
import { Language } from '../types';

interface FeedbackPageProps {
  lang: Language;
}

const WHATSAPP_NUMBER = '923003764818';

const userTypes = ['Driver / Captain', 'Company Staff', 'Customer', 'Admin', 'Accountant', 'Other'];
const relatedAreas = ['Trip', 'Trip Invoice', 'VAT Dashboard', 'Expense', 'Vehicle', 'Rental', 'Driver', 'Customer', 'App Issue', 'New Feature', 'Other'];
const priorities = ['Normal', 'Important', 'Urgent'];

const FeedbackPage: React.FC<FeedbackPageProps> = ({ lang }) => {
  const [form, setForm] = useState({
    name: '',
    mobile: '',
    userType: userTypes[0],
    relatedArea: relatedAreas[0],
    priority: priorities[0],
    message: '',
  });

  const fontClass = lang === 'ar' ? 'font-ar' : lang === 'ur' ? 'font-ur' : '';
  const whatsappUrl = useMemo(() => {
    const message = [
      'TMS KSA Feedback',
      '',
      `Name: ${form.name}`,
      `Mobile: ${form.mobile}`,
      `User Type: ${form.userType}`,
      `Related Area: ${form.relatedArea}`,
      `Priority: ${form.priority}`,
      '',
      'Message:',
      form.message,
      '',
      `App Page: ${window.location.href}`,
    ].join('\n');
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }, [form]);

  return (
    <div className={`p-4 space-y-5 ${fontClass}`}>
      <section className="surface-panel rounded-[2.25rem] p-5 overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-[var(--cyan)]/15 via-transparent to-[var(--amber)]/20" />
        <div className="relative space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--cyan)]">Help &amp; Feedback</p>
          <h2 className="text-2xl font-black tracking-tight text-[var(--ink)]">What do you want to add here?</h2>
          <p className="text-sm text-[var(--ink-soft)]/75 leading-6">
            Your feedback will help us design the final backend and app workflow.
          </p>
        </div>
      </section>

      <section className="surface-panel rounded-[2.25rem] p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Name</span>
            <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm text-[var(--ink)] outline-none" />
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Mobile Number</span>
            <input value={form.mobile} onChange={(e) => setForm((prev) => ({ ...prev, mobile: e.target.value }))} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm text-[var(--ink)] outline-none" />
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">User Type</span>
            <select value={form.userType} onChange={(e) => setForm((prev) => ({ ...prev, userType: e.target.value }))} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm text-[var(--ink)] outline-none">
              {userTypes.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Related Area</span>
            <select value={form.relatedArea} onChange={(e) => setForm((prev) => ({ ...prev, relatedArea: e.target.value }))} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm text-[var(--ink)] outline-none">
              {relatedAreas.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Priority</span>
            <select value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm text-[var(--ink)] outline-none">
              {priorities.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Message / Suggestion</span>
            <textarea value={form.message} onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))} rows={6} className="w-full rounded-[1.75rem] border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-sm text-[var(--ink)] outline-none resize-none" />
          </label>
        </div>

        <div className="rounded-[1.75rem] border border-dashed border-[var(--line)] bg-white/50 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-soft)]/65">Optional Attachment</p>
          <p className="mt-2 text-sm text-[var(--ink-soft)]/75">Upload placeholder only for demo. No backend file upload is required yet.</p>
        </div>

        <a href={whatsappUrl} target="_blank" rel="noreferrer" className="block w-full brand-action rounded-[1.75rem] px-5 py-4 text-center text-[11px] font-black uppercase tracking-[0.24em]">
          Send Feedback on WhatsApp
        </a>
      </section>
    </div>
  );
};

export default FeedbackPage;

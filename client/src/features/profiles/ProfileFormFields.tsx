import { Eye, EyeOff, Plus } from 'lucide-react';
import { Button, Field, Input } from '../../components/ui';
import type { ProfileForm } from './profilesApi';

/** Shared detail fields for tap profiles (admin dialog + self-service page). */
export function ProfileFormFields({
  form,
  set,
}: {
  form: ProfileForm;
  set: (k: keyof ProfileForm, v: string | boolean | ProfileForm['links']) => void;
}): JSX.Element {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Display name" htmlFor="pf-name">
          <Input id="pf-name" value={form.displayName} onChange={(e) => set('displayName', e.target.value)} placeholder="Akshay Nagdiya" />
        </Field>
        <Field label="Title / role" htmlFor="pf-title">
          <Input id="pf-title" value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="Sales Manager" />
        </Field>
        <Field label="Link slug (optional)" htmlFor="pf-slug" hint="Changing it breaks already-written cards.">
          <Input id="pf-slug" value={form.slug ?? ''} onChange={(e) => set('slug', e.target.value.toLowerCase())} placeholder="akshay-nagdiya" className="font-mono" />
        </Field>
        <Field label="Photo URL (optional)" htmlFor="pf-photo">
          <Input id="pf-photo" value={form.photoUrl ?? ''} onChange={(e) => set('photoUrl', e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Phone (tap-to-call)" htmlFor="pf-phone" hint="E.164, e.g. +919876543210">
          <Input id="pf-phone" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="+91…" inputMode="tel" />
        </Field>
        <Field label="WhatsApp (optional)" htmlFor="pf-wa">
          <Input id="pf-wa" value={form.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} placeholder="+91…" inputMode="tel" />
        </Field>
        <Field label="Email" htmlFor="pf-email">
          <Input id="pf-email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" inputMode="email" />
        </Field>
        <Field label="Website (optional)" htmlFor="pf-web">
          <Input id="pf-web" value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} placeholder="https://…" inputMode="url" />
        </Field>
      </div>

      <div className="space-y-2">
        <p className="text-[12.5px] font-semibold text-white/85">Social links (max 12)</p>
          {form.links.map((l, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row">
              <Input value={l.label} onChange={(e) => set('links', form.links.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Instagram" aria-label="Link label" />
              <Input value={l.url} onChange={(e) => set('links', form.links.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="https://…" aria-label="Link URL" inputMode="url" />
              <Button variant="secondary" onClick={() => set('links', form.links.filter((_, j) => j !== i))} aria-label="Remove link" className="shrink-0 self-end sm:self-auto">✕</Button>
            </div>
          ))}
        {form.links.length < 12 && (
          <Button variant="secondary" onClick={() => set('links', [...form.links, { label: '', url: '' }])}><Plus size={15} /> Add link</Button>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.isPublic} onChange={(e) => set('isPublic', e.target.checked)} className="h-4 w-4" />
        <span className="inline-flex items-center gap-1.5">{form.isPublic ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />} Public (uncheck to disable the link without deleting)</span>
      </label>
    </>
  );
}

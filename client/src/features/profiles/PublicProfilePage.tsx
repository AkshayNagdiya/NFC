import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Link as LinkIcon,
  Mail,
  MessageCircle,
  Phone,
  Twitter,
  UserRound,
  Youtube,
} from 'lucide-react';
import { api } from '../../lib/api';

export interface PublicProfile {
  slug: string;
  displayName: string;
  title?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  website?: string;
  links: { label: string; url: string }[];
  photoUrl?: string;
  views: number;
}

function socialIcon(label: string, url: string): JSX.Element {
  const l = label.toLowerCase();
  const u = url.toLowerCase();
  if (l.includes('insta') || u.includes('instagram')) return <Instagram size={18} aria-hidden />;
  if (l.includes('linkedin') || u.includes('linkedin')) return <Linkedin size={18} aria-hidden />;
  if (l.includes('twitter') || l === 'x' || u.includes('twitter') || u.includes('x.com')) return <Twitter size={18} aria-hidden />;
  if (l.includes('facebook') || u.includes('facebook')) return <Facebook size={18} aria-hidden />;
  if (l.includes('youtube') || u.includes('youtube')) return <Youtube size={18} aria-hidden />;
  return <LinkIcon size={18} aria-hidden />;
}

function waNumber(n: string): string {
  return n.replace(/\D/g, '');
}

export function PublicProfilePage(): JSX.Element {
  const { slug } = useParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = (await api.get(`/profiles/p/${slug}`)).data.data as PublicProfile;
        setProfile(res);
      } catch {
        setError('This profile link is invalid or unpublished. Ask the owner for a new one.');
      }
    })();
  }, [slug]);

  if (error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center" role="alert">
        <p className="text-xl font-semibold">Profile not found</p>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6" aria-label="Loading profile">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const vcardUrl = `${import.meta.env.VITE_API_URL ?? '/api'}/profiles/p/${profile.slug}/vcard`;

  return (
    <div className="mx-auto min-h-screen w-full max-w-md space-y-5 px-5 py-10">
      <div className="text-center">
        {profile.photoUrl ? (
          <img src={profile.photoUrl} alt={profile.displayName} className="mx-auto h-24 w-24 rounded-full border border-border object-cover" />
        ) : (
          <span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-b from-[#F0D48A] to-[#8F6A2E] text-black">
            <UserRound size={40} aria-hidden />
          </span>
        )}
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{profile.displayName}</h1>
        {profile.title && <p className="mt-1 text-sm text-muted-foreground">{profile.title}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {profile.phone && (
          <a href={`tel:${profile.phone}`} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground">
            <Phone size={17} aria-hidden /> Call
          </a>
        )}
        <a href={vcardUrl} className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3.5 text-sm font-semibold hover:bg-muted" download>
          <UserRound size={17} aria-hidden /> Save contact
        </a>
        {profile.whatsapp && (
          <a href={`https://wa.me/${waNumber(profile.whatsapp)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3.5 text-sm font-semibold hover:bg-muted">
            <MessageCircle size={17} aria-hidden /> WhatsApp
          </a>
        )}
        {profile.email && (
          <a href={`mailto:${profile.email}`} className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3.5 text-sm font-semibold hover:bg-muted">
            <Mail size={17} aria-hidden /> Email
          </a>
        )}
      </div>

      {profile.website && (
        <a href={profile.website} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted">
          <Globe size={16} aria-hidden /> <span className="truncate">{profile.website.replace(/^https?:\/\//, '')}</span>
        </a>
      )}

      {profile.links.length > 0 && (
        <ul className="space-y-2">
          {profile.links.map((l) => (
            <li key={`${l.label}-${l.url}`}>
              <a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted">
                {socialIcon(l.label, l.url)} {l.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

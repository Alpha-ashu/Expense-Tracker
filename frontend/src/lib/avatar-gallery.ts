export type AvatarGender = 'male' | 'female' | 'neutral';
export type AvatarStyle = 'casual' | 'professional' | 'sport';
export type AvatarSkinTone = 'light' | 'tan' | 'brown' | 'dark';

export type AvatarOption = {
  id: string;
  url: string;
  gender: AvatarGender;
  style: AvatarStyle;
  skinTone: AvatarSkinTone;
  label: string;
};

const avatarModules = import.meta.glob('../assets/avatars/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const AVATAR_FILES = Object.entries(avatarModules)
  .map(([path, url]) => ({ path, url }))
  .sort((a, b) => a.path.localeCompare(b.path));

const titleize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const decodeName = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const getFilename = (value: string) => {
  const cleaned = value.split('?')[0];
  const parts = cleaned.split('/');
  return decodeName(parts[parts.length - 1] || '');
};

const toLabel = (file: string) => {
  const base = getFilename(file).replace(/\.[^.]+$/, '');
  const cleaned = base.replace(/\(|\)/g, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? titleize(cleaned) : 'Avatar';
};

const toId = (file: string, index: number) => {
  const base = getFilename(file).replace(/\.[^.]+$/, '');
  const cleaned = base.replace(/\(|\)/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return cleaned ? cleaned : `avatar-${index + 1}`;
};

const toUrl = (url: string) => url;

const buildOptions = (): AvatarOption[] =>
  AVATAR_FILES.map((file, index): AvatarOption => ({
    id: toId(file.path, index),
    url: toUrl(file.url),
    gender: 'neutral',
    style: 'casual',
    skinTone: 'tan',
    label: toLabel(file.path),
  }));

const FALLBACK_AVATAR: AvatarOption = {
  id: 'avatar-default',
  url: '',
  gender: 'neutral',
  style: 'casual',
  skinTone: 'tan',
  label: 'Default Avatar',
};

export const AVATAR_OPTIONS: AvatarOption[] = buildOptions();
if (AVATAR_OPTIONS.length === 0) {
  AVATAR_OPTIONS.push(FALLBACK_AVATAR);
}

export const DEFAULT_AVATAR = AVATAR_OPTIONS[0];

const toPath = (value?: string | null): string | null => {
  if (!value) return null;
  if (value.startsWith('/')) return value.split('?')[0];
  if (value.startsWith('avatars/')) return `/${value}`.split('?')[0];
  try {
    const parsed = new URL(value);
    return parsed.pathname;
  } catch {
    return value;
  }
};

export const getAvatarById = (id?: string | null) =>
  AVATAR_OPTIONS.find((option) => option.id === id) || null;

export const getAvatarByUrl = (url?: string | null) => {
  const path = toPath(url);
  if (!path) return null;
  const direct = AVATAR_OPTIONS.find((option) => option.url === path);
  if (direct) return direct;
  const filename = getFilename(path);
  if (!filename) return null;
  return AVATAR_OPTIONS.find((option) => getFilename(option.url) === filename) || null;
};

export const resolveAvatarSelection = (args?: {
  avatarId?: string | null;
  avatarUrl?: string | null;
}) => {
  const byId = args?.avatarId ? getAvatarById(args.avatarId) : null;
  if (byId) return byId;
  const byUrl = getAvatarByUrl(args?.avatarUrl ?? null);
  if (byUrl) return byUrl;
  return DEFAULT_AVATAR;
};

export const normalizeAvatarUrl = (avatarUrl?: string | null) =>
  getAvatarByUrl(avatarUrl)?.url || DEFAULT_AVATAR.url;

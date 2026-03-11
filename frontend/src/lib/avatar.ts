export type AgeGroup = 'teen' | 'young_adult' | 'adult' | 'mature';

export type AvatarGender = 'male' | 'female' | 'neutral';

export type AvatarConfig = {
  seed: string;
  gender: AvatarGender;
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  glasses: string;
  beard: string;
  clothing: string;
  clothingColor: string;
  backgroundColor: string;
};

export type AvatarGalleryItem = {
  id: string;
  seed: string;
  url: string;
};

const randomPick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export const SKIN_TONES = ['Light', 'Pale', 'Tanned', 'Brown', 'DarkBrown', 'Black'];
export const HAIR_COLORS = ['Black', 'Brown', 'BrownDark', 'Blonde', 'Auburn', 'SilverGray'];
export const GLASSES = ['Blank', 'Prescription01', 'Prescription02', 'Round', 'Wayfarers'];
export const BEARDS = ['Blank', 'BeardLight', 'BeardMedium', 'BeardMajestic', 'MoustacheFancy'];
export const CLOTHING_COLORS = ['Black', 'Blue02', 'Gray01', 'Heather', 'PastelBlue', 'PastelGreen', 'PastelRed', 'White'];
export const BACKGROUND_COLORS = ['b6e3f4', 'c0aede', 'ffdfbf', 'd1d4f9', 'ffd5dc', 'c7f0bd', 'f4d2b6'];

const TEEN_HAIR = ['ShortHairShaggyMullet', 'ShortHairShortCurly', 'ShortHairShortRound', 'LongHairStraight2', 'LongHairCurly'];
const YOUNG_HAIR = ['ShortHairShortFlat', 'ShortHairSides', 'ShortHairFrizzle', 'LongHairStraight', 'LongHairNotTooLong'];
const ADULT_HAIR = ['ShortHairTheCaesar', 'ShortHairTheCaesarSidePart', 'LongHairStraight', 'LongHairBob'];
const MATURE_HAIR = ['ShortHairShortWaved', 'ShortHairShortFlat', 'LongHairStraightStrand', 'NoHair'];

const TEEN_CLOTHING = ['Hoodie', 'GraphicShirt', 'Overall', 'ShirtCrewNeck'];
const YOUNG_CLOTHING = ['ShirtVNeck', 'ShirtCrewNeck', 'BlazerShirt', 'Hoodie'];
const ADULT_CLOTHING = ['BlazerSweater', 'CollarSweater', 'BlazerShirt', 'ShirtScoopNeck'];
const MATURE_CLOTHING = ['CollarSweater', 'BlazerSweater', 'ShirtScoopNeck'];

export const calculateAge = (dateOfBirth?: string | Date) => {
  if (!dateOfBirth) return null;
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
};

export const getAgeGroup = (age: number | null): AgeGroup => {
  if (age === null || age < 19) return 'teen';
  if (age < 31) return 'young_adult';
  if (age < 46) return 'adult';
  return 'mature';
};

export const getAgeGroupLabel = (group: AgeGroup) => {
  switch (group) {
    case 'teen':
      return 'Teen';
    case 'young_adult':
      return 'Young Adult';
    case 'adult':
      return 'Professional Adult';
    case 'mature':
      return 'Mature';
    default:
      return 'User';
  }
};

const hairByAge = (group: AgeGroup) => {
  switch (group) {
    case 'teen':
      return TEEN_HAIR;
    case 'young_adult':
      return YOUNG_HAIR;
    case 'adult':
      return ADULT_HAIR;
    case 'mature':
      return MATURE_HAIR;
    default:
      return YOUNG_HAIR;
  }
};

const clothingByAge = (group: AgeGroup) => {
  switch (group) {
    case 'teen':
      return TEEN_CLOTHING;
    case 'young_adult':
      return YOUNG_CLOTHING;
    case 'adult':
      return ADULT_CLOTHING;
    case 'mature':
      return MATURE_CLOTHING;
    default:
      return YOUNG_CLOTHING;
  }
};

export const getHairOptions = (group: AgeGroup) => hairByAge(group);
export const getClothingOptions = (group: AgeGroup) => clothingByAge(group);

const generateSeed = (name?: string) =>
  `${name || 'user'}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;

export const createAvatarConfig = (params: {
  name?: string;
  ageGroup?: AgeGroup;
  gender?: AvatarGender;
  seed?: string;
}): AvatarConfig => {
  const ageGroup = params.ageGroup ?? 'young_adult';
  const gender = params.gender ?? 'neutral';
  return {
    seed: params.seed ?? generateSeed(params.name),
    gender,
    skinTone: randomPick(SKIN_TONES),
    hairStyle: randomPick(hairByAge(ageGroup)),
    hairColor: randomPick(HAIR_COLORS),
    glasses: randomPick(GLASSES),
    beard: gender === 'female' ? 'Blank' : randomPick(BEARDS),
    clothing: randomPick(clothingByAge(ageGroup)),
    clothingColor: randomPick(CLOTHING_COLORS),
    backgroundColor: randomPick(BACKGROUND_COLORS),
  };
};

export const randomizeAvatarConfig = (current: AvatarConfig, ageGroup: AgeGroup) => ({
  ...current,
  seed: generateSeed(current.seed),
  skinTone: randomPick(SKIN_TONES),
  hairStyle: randomPick(hairByAge(ageGroup)),
  hairColor: randomPick(HAIR_COLORS),
  glasses: randomPick(GLASSES),
  beard: current.gender === 'female' ? 'Blank' : randomPick(BEARDS),
  clothing: randomPick(clothingByAge(ageGroup)),
  clothingColor: randomPick(CLOTHING_COLORS),
  backgroundColor: randomPick(BACKGROUND_COLORS),
});

const DICEBEAR_STYLE = 'adventurer';

export const buildAvatarUrlFromSeed = (seed: string, backgroundColor?: string) => {
  const params = new URLSearchParams({
    seed,
  });

  if (backgroundColor) {
    params.set('backgroundColor', backgroundColor);
  }

  return `https://api.dicebear.com/7.x/${DICEBEAR_STYLE}/svg?${params.toString()}`;
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const generateAvatarGallery = ({
  seed,
  count = 16,
  salt = 0,
}: {
  seed: string;
  count?: number;
  salt?: number;
}): AvatarGalleryItem[] => {
  const base = seed || 'user';
  return Array.from({ length: count }, (_, index) => {
    const itemSeed = `${base}-${salt}-${index}`;
    const colorIndex = hashString(itemSeed) % BACKGROUND_COLORS.length;
    const backgroundColor = BACKGROUND_COLORS[colorIndex];
    return {
      id: `${salt}-${index}`,
      seed: itemSeed,
      url: buildAvatarUrlFromSeed(itemSeed, backgroundColor),
    };
  });
};

export const buildAvatarUrl = (config: AvatarConfig) =>
  buildAvatarUrlFromSeed(config.seed, config.backgroundColor);

export const parseAvatarUrl = (url?: string | null): Partial<AvatarConfig> => {
  if (!url) return {};
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;
    return {
      seed: params.get('seed') || undefined,
      backgroundColor: params.get('backgroundColor') || undefined,
      skinTone: params.get('skinColor') || undefined,
      hairStyle: params.get('top') || undefined,
      hairColor: params.get('hairColor') || undefined,
      glasses: params.get('accessories') || undefined,
      beard: params.get('facialHair') || undefined,
      clothing: params.get('clothing') || undefined,
      clothingColor: params.get('clothingColor') || undefined,
    };
  } catch {
    return {};
  }
};

export const mergeAvatarConfig = (base: AvatarConfig, overrides?: Partial<AvatarConfig>) => ({
  ...base,
  ...Object.fromEntries(Object.entries(overrides || {}).filter(([, value]) => value != null && value !== '')),
});

export type AgeGroup = 'teen' | 'young_adult' | 'adult' | 'mature';

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

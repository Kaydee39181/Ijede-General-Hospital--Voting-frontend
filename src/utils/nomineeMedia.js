const explicitNomineePhotoMap = {
  'cno ojo oye yemi': '/nominees/CNO_Ojo_Oyeyemi.jpeg'
};

const normalizeNomineeName = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const splitNomineeName = (name) =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

export const getNomineePhoto = (name) => {
  const normalizedName = normalizeNomineeName(name);

  if (explicitNomineePhotoMap[normalizedName]) {
    return explicitNomineePhotoMap[normalizedName];
  }

  const parts = normalizedName.split(' ').filter(Boolean);

  if (!parts.length) {
    return '';
  }

  const fileName = parts
    .map((part) => (part.length <= 3 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`))
    .join('_');

  return `/nominees/${fileName}.jpeg`;
};

export const getNomineeInitials = (name) => {
  const parts = splitNomineeName(name);

  if (!parts.length) {
    return '?';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

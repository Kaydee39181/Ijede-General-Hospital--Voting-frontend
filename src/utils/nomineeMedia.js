const explicitNomineePhotoMap = {
  'adns balogun a': '/nominees/ADNS_Balogun_A.jpeg',
  'adns adeyiolu': '/nominees/ADNS_Adeyiolu.jpg',
  'adns jetawo': '/nominees/ADNS_Jetawo.jpeg',
  'adns salami': '/nominees/ADNS_Salami.jpeg',
  'cno adetunji': '/nominees/CNO_Adetunji.jpeg',
  'cno ismail': '/nominees/CNO_Ismail.jpeg',
  'cno ojo oye yemi': '/nominees/CNO_Ojo_Oyeyemi.jpeg',
  'cno olorunnimbe': '/nominees/CNO_Olorunnimbe.jpeg',
  'cno otayomi': '/nominees/CNO_Otayomi.jpg',
  'cno oyefeso': '/nominees/CNO_Oyefeso.jpeg',
  'no i pelemo': '/nominees/NO_II_Pelemo.jpg',
  'no ii pelemo': '/nominees/NO_II_Pelemo.jpg',
  'no ii ajisafe': '/nominees/NO_II_Ajisafe.jpeg',
  'no ii emode': '/nominees/NO_II_Emode.jpeg',
  'sn adegboye': '/nominees/SN_Adegboye.jpg',
  'sn hassan': '/nominees/SN_Hassan_A.jpg',
  'sno adeleke': '/nominees/SNO_Adeleke.jpg',
  'sno abeeb': '/nominees/SNO_Abeeb.jpeg',
  'sno akintola': '/nominees/SNO_Akintola.jpeg'
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

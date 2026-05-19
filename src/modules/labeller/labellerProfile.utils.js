const USER_POPULATE_FIELDS = 'name email profilePicture role status userId createdAt updatedAt balance tier isOnboarded location languages performance earnings averageRating';

const toArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeLocation = (location) => {
  if (!location) {
    return undefined;
  }

  if (typeof location === 'string') {
    const [country = '', city = '', region = ''] = location
      .split(',')
      .map((item) => item.trim());

    return {
      country,
      city,
      region: region || city,
    };
  }

  if (typeof location === 'object') {
    return {
      country: location.country || '',
      city: location.city || '',
      region: location.region || location.state || '',
    };
  }

  return undefined;
};

const normalizeYearsOfExperience = (experienceDuration, yearsOfExperience) => {
  if (typeof yearsOfExperience === 'number' && !Number.isNaN(yearsOfExperience)) {
    return yearsOfExperience;
  }

  const durationMap = {
    less_than_3_months: 0.25,
    '3_to_12_months': 0.75,
    '1_to_3_years': 2,
    '3_plus_years': 3,
  };

  return durationMap[experienceDuration] ?? undefined;
};

export const normalizeLabellerProfilePayload = (payload = {}) => {
  const profileSource = payload.profile || payload;
  const expertiseSource = payload.expertise || payload;
  const annotationExperience = payload.annotationExperience || {};

  const profile = {};
  if (profileSource.gender) {
    profile.gender = profileSource.gender;
  }
  if (profileSource.dateOfBirth) {
    profile.dateOfBirth = profileSource.dateOfBirth;
  }

  const normalizedLocation = normalizeLocation(profileSource.location);
  if (normalizedLocation) {
    profile.location = normalizedLocation;
  }

  const languages = toArray(profileSource.languages || payload.languages);
  if (languages.length > 0) {
    profile.languages = languages;
  }

  const expertise = {};
  const skills = toArray(expertiseSource.skills || expertiseSource.skillTags || expertiseSource.expertise || payload.skillTags);
  if (skills.length > 0) {
    expertise.skills = skills;
  }

  const annotationTypes = toArray(payload.skillTags || annotationExperience.experienceTypes);
  if (annotationTypes.length > 0) {
    expertise.annotationTypes = annotationTypes;
  }

  const toolsUsed = toArray(annotationExperience.toolsUsed);
  if (toolsUsed.length > 0) {
    expertise.toolsUsed = toolsUsed;
  }

  const yearsOfExperience = normalizeYearsOfExperience(
    annotationExperience.experienceDuration,
    annotationExperience.yearsOfExperience,
  );
  if (typeof yearsOfExperience === 'number') {
    expertise.yearsOfExperience = yearsOfExperience;
  }

  if (annotationExperience.description) {
    expertise.description = annotationExperience.description;
  }

  const normalized = {};
  if (Object.keys(profile).length > 0) {
    normalized.profile = profile;
  }
  if (Object.keys(expertise).length > 0) {
    normalized.expertise = expertise;
  }

  if (payload.tier) {
    normalized.tier = payload.tier;
  }

  if (typeof payload.isOnboarded === 'boolean') {
    normalized.isOnboarded = payload.isOnboarded;
  }

  if (payload.status) {
    normalized.status = payload.status;
  }

  return normalized;
};

export const populateLabellerUser = (query) => query.populate('userId', USER_POPULATE_FIELDS);

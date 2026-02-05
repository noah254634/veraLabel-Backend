const updateUserLocation = async (req, res, next) => {
  if (!req.user || !req.geo) return next();

  const { country, city, state } = req.geo;
  const prev = req.user.userLocation;

  const hasChanged =
    prev?.country !== country ||
    prev?.city !== city ||
    prev?.state !== state;

  const lastUpdated = req.user.locationUpdatedAt;
  const tooSoon =
    lastUpdated && Date.now() - lastUpdated.getTime() < 24 * 60 * 60 * 1000;

  if (!hasChanged || tooSoon) return next();

  await UserVera.findByIdAndUpdate(req.user._id, {
    userLocation: { country, city, state },
    locationUpdatedAt: new Date()
  });

  next();
};
export default updateUserLocation;
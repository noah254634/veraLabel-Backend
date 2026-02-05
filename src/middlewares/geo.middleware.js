import geoip from 'geoip-lite'

const ALLOWED_COUNTRIES = ['KE', 'UG', 'TZ', 'RW', 'BI', 'SS']

export const geoMiddleware = (req, res, next) => {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket.remoteAddress

  const geo = geoip.lookup(ip)

  if (!geo) {
    return res.status(400).json({
      message: 'Unable to determine your location'
    })
  }

  const { country, city, timezone, ll } = geo

  if (!ALLOWED_COUNTRIES.includes(country)) {
    return res.status(403).json({
      message:
        'Thank you for your interest in working with us. Currently our services are available in East Africa only. We shall get back to you when we expand.'
    })
  }

  // attach context to request
  req.geo = {
    country,
    city,
    timezone,
    coords: ll || []
  }
  console.log(req.geo);
  next()
}

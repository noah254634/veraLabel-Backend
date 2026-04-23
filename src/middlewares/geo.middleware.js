import geoip from 'geoip-lite'

const ALLOWED_COUNTRIES = ['KE', 'UG', 'TZ', 'RW', 'BI', 'SS']

export const geoMiddleware = (req, res, next) => {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket.remoteAddress

  console.log('🔍 Geo Middleware - IP detected:', ip)

  // Special handling for localhost/private IPs - add test data
  if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1' || ip?.startsWith('192.168.') || ip?.startsWith('10.')) {
    req.geo = {
      country: 'KE',
      city: 'Nairobi (Local/Test)',
      timezone: 'Africa/Nairobi',
      coords: [-1.2865, 36.8172]
    }
    console.log('✅ Local IP detected - Using test geo data:', req.geo)
    return next()
  }

  const geo = geoip.lookup(ip)
  console.log('Geoip lookup result:', geo)

  if (!geo) {
    console.log('Geo lookup failed - no location data for IP:', ip)
    return res.status(400).json({
      message: 'Unable to determine your location'
    })
  }

  const { country, city, timezone, ll } = geo
  console.log('Location found:', { country, city, timezone, coords: ll })

  if (!ALLOWED_COUNTRIES.includes(country)) {
    console.log(' Country blocked:', country)
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
  console.log('✔️ Geo check passed - User allowed:', req.geo)
  next()
}

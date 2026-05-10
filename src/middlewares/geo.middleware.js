import geoip from 'geoip-lite'

const ALLOWED_COUNTRIES = ['KE', 'UG', 'TZ', 'RW', 'BI', 'SS']

export const geoMiddleware = (req, res, next) => {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket.remoteAddress

  // Bypass for local/private IPs
  if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1' || ip?.startsWith('192.168.') || ip?.startsWith('10.')) {
    req.geo = { country: 'KE', city: 'Nairobi (Local)', timezone: 'Africa/Nairobi', coords: [-1.2865, 36.8172] };
    return next();
  }

  // NEW: Bypass for Cloudflare Worker (identified by Handshake or Internal Secret)
  const handshakeHeader = req.headers['handshake-url'];
  const authHeader = req.headers['authorization'];
  const expectedHandshake = process.env.HANDSHAKE_URL;
  const expectedToken = process.env.TOKEN_VALUE;

  if (
    (handshakeHeader && handshakeHeader === expectedHandshake) ||
    (authHeader && authHeader === `Bearer ${expectedToken}`)
  ) {
    req.geo = { country: 'KE', city: 'Worker (Cloudflare)', timezone: 'Africa/Nairobi', coords: [] };
    return next();
  }

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
  next()
}

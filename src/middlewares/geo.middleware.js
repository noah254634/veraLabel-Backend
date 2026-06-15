import geoip from 'geoip-lite'
import logger from '../config/logger.js'
import GeoAccessLog from '../modules/admin/models/geoAccessLog.model.js'

const ALLOWED_COUNTRIES = ['KE', 'UG', 'TZ', 'RW', 'BI', 'SS']

// Helper to clean and normalize IP addresses
const cleanIp = (ipAddress) => {
  if (!ipAddress) return '';
  let ip = ipAddress.trim();
  
  // Strip IPv6 prefix for IPv4-mapped IPv6 addresses (e.g., ::ffff:127.0.0.1)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  
  // Strip port if present (common in proxy setups like Azure Web Apps / ARR)
  if (ip.startsWith('[')) {
    const closeBracket = ip.indexOf(']');
    if (closeBracket !== -1) {
      ip = ip.substring(1, closeBracket);
    }
  } else if (ip.includes('.')) {
    const lastColon = ip.lastIndexOf(':');
    if (lastColon !== -1 && lastColon > ip.lastIndexOf('.')) {
      ip = ip.substring(0, lastColon);
    }
  }
  return ip;
};

// Helper to check if IP is private/loopback
const isPrivateOrLoopbackIp = (ip) => {
  if (!ip) return true;
  if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1' || ip === '::') {
    return true;
  }
  
  // Class A: 10.0.0.0/8
  if (ip.startsWith('10.')) return true;
  
  // Class B: 172.16.0.0/12
  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    if (parts.length >= 2) {
      const secondOctet = parseInt(parts[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return true;
      }
    }
  }
  
  // Class C: 192.168.0.0/16
  if (ip.startsWith('192.168.')) return true;
  
  // Link-local: 169.254.0.0/16
  if (ip.startsWith('169.254.')) return true;
  
  // CGNAT: 100.64.0.0/10
  if (ip.startsWith('100.')) {
    const parts = ip.split('.');
    if (parts.length >= 2) {
      const secondOctet = parseInt(parts[1], 10);
      if (secondOctet >= 64 && secondOctet <= 127) {
        return true;
      }
    }
  }
  
  return false;
};

export const geoMiddleware = (req, res, next) => {
  // Check if geo checks are bypassed completely via environment variable
  if (process.env.BYPASS_GEO_CHECK === 'true') {
    req.geo = { country: 'KE', city: 'Bypassed (Env Flag)', timezone: 'Africa/Nairobi', coords: [-1.2865, 36.8172] };
    return next();
  }

  // Extract IP from all potential client IP headers to support Cloudflare, Azure, proxies, etc.
  const rawIp =
    req.headers['cf-connecting-ip'] ||
    req.headers['x-client-ip'] ||
    req.headers['x-arr-clientaddr'] ||
    req.ip ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket.remoteAddress;

  const ip = cleanIp(rawIp);

  // Bypass geo lookup for local/private/loopback IPs
  if (isPrivateOrLoopbackIp(ip)) {
    logger.info(`GeoIP Bypass: Private/Loopback IP detected (${ip || 'unknown'}). Defaulting to KE.`);
    req.geo = { country: 'KE', city: 'Nairobi (Local)', timezone: 'Africa/Nairobi', coords: [-1.2865, 36.8172] };
    return next();
  }

  // Bypass for Cloudflare Worker (identified by Handshake or Internal Secret)
  const handshakeHeader = req.headers['handshake-url'];
  const authHeader = req.headers['authorization'];
  const expectedHandshake =
    process.env.HANDSHAKE_URL ||
    process.env.BACKEND_HANDSHAKE_URL ||
    process.env.BACKEND_HANDSHAKE;
  const expectedToken =
    process.env.TOKEN_VALUE ||
    process.env.INTERNAL_SECRET ||
    process.env.BACKEND_TOKEN;

  if (
    (handshakeHeader && handshakeHeader === expectedHandshake) ||
    (authHeader && authHeader === `Bearer ${expectedToken}`)
  ) {
    req.geo = { country: 'KE', city: 'Worker (Cloudflare)', timezone: 'Africa/Nairobi', coords: [] };
    return next();
  }

  const geo = geoip.lookup(ip)

  if (!geo) {
    logger.warn(`GeoIP Warning: Unable to determine location for IP: ${ip}. Raw IP source: ${rawIp}`);
    return res.status(400).json({
      message: 'Unable to determine your location'
    })
  }

  const { country, city, timezone, ll } = geo
  console.log("Country", country);
  console.log("City", city);
  console.log("Timezone", timezone);
  console.log("Coords", ll);

  // Log access if country is not Kenya
  if (country !== 'KE') {
    const isBlocked = !ALLOWED_COUNTRIES.includes(country) && !req.originalUrl.includes('/payments/paystack/webhook');
    GeoAccessLog.findOneAndUpdate(
      { ip },
      {
        $set: {
          country: country || 'Unknown',
          city: city || 'Unknown',
          timezone: timezone || 'Unknown',
          coordinates: ll || [],
          userAgent: req.headers['user-agent'] || 'Unknown',
          lastPath: req.originalUrl || req.path || 'Unknown',
          lastMethod: req.method || 'GET',
          isBlocked,
          lastAccess: new Date()
        },
        $inc: { hits: 1 }
      },
      { upsert: true }
    ).catch((err) => {
      logger.error('Failed to log geo access attempt in middleware', { error: err.message });
    });
  }

  // Bypass for Paystack Webhooks
  if (req.originalUrl.includes('/payments/paystack/webhook')) {
    logger.info(`Paystack webhook received in geo middleware`, { geo: geo });
    return next();
  }

  if (!ALLOWED_COUNTRIES.includes(country)) {
    logger.warn(`GeoIP Blocked: IP ${ip} from ${country} (${city || 'unknown'}) is not in allowed countries list.`);
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

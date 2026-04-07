const createRateLimiter = ({
  windowMs = 60 * 1000,
  max = 60,
  message = "Too many requests, please try again later",
  keyGenerator = (req) => req.ip || req.headers["x-forwarded-for"] || "unknown",
} = {}) => {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyGenerator(req)}:${req.path}`;
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(max - 1));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1000)));
      return next();
    }

    if (current.count >= max) {
      res.setHeader("Retry-After", String(Math.ceil((current.resetAt - now) / 1000)));
      return res.status(429).json({ message });
    }

    current.count += 1;
    hits.set(key, current);

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(max - current.count));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(current.resetAt / 1000)));
    return next();
  };
};

export { createRateLimiter };

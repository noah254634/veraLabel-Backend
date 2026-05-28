// ─── Logger ──────────────────────────────────────────────────────────────────
// Structured, colorized console logger.
// Mirrors the pino / winston API surface used across the codebase:
//   logger.info(msg)
//   logger.info(msg, meta)
//   logger.error(err | meta, msg?)
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  // levels
  info:    '\x1b[36m',   // cyan
  warn:    '\x1b[33m',   // yellow
  error:   '\x1b[31m',   // red
  debug:   '\x1b[35m',   // magenta
  // meta
  gray:    '\x1b[90m',
  white:   '\x1b[37m',
};

const LEVEL_LABELS = {
  info:  'INFO ',
  warn:  'WARN ',
  error: 'ERROR',
  debug: 'DEBUG',
};

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

/**
 * Format the second argument.
 * - If it's a string, append inline.
 * - If it's an Error, print its message + stack.
 * - If it's an object, pretty-print as JSON on the next line.
 */
function formatExtra(extra) {
  if (extra === undefined || extra === null) return '';

  if (extra instanceof Error) {
    return `\n  ${COLORS.dim}${extra.stack || extra.message}${COLORS.reset}`;
  }

  if (typeof extra === 'object') {
    try {
      return `\n  ${COLORS.dim}${JSON.stringify(extra, null, 2)
        .split('\n')
        .join('\n  ')}${COLORS.reset}`;
    } catch {
      return ` ${String(extra)}`;
    }
  }

  return ` ${extra}`;
}

/**
 * Normalise the first argument.
 * Supports:
 *   logger.info("simple string")
 *   logger.error(new Error("boom"))
 *   logger.error({ message, path, ... })           ← pino-style meta-first
 *   logger.error({ message, ... }, "extra label")
 */
function normalizeArgs(level, args) {
  const [first, ...rest] = args;
  let message = '';
  let extra   = undefined;

  if (typeof first === 'string') {
    message = first;
    extra   = rest.length === 1 ? rest[0] : rest.length > 1 ? rest : undefined;
  } else if (first instanceof Error) {
    message = first.message;
    extra   = first;
  } else if (first && typeof first === 'object') {
    // pino convention: first arg is meta-object, second is the message string
    const { message: msg, stack, ...meta } = first;
    message = rest[0] || msg || level;
    // merge stack back into meta for display
    extra = Object.keys(meta).length > 0
      ? (stack ? { ...meta, stack } : meta)
      : (stack ? { stack } : undefined);
  } else {
    message = String(first ?? '');
    extra   = rest.length === 1 ? rest[0] : rest.length > 1 ? rest : undefined;
  }

  return { message, extra };
}

function log(level, ...args) {
  const color  = COLORS[level] || COLORS.white;
  const label  = LEVEL_LABELS[level] || level.toUpperCase();
  const { message, extra } = normalizeArgs(level, args);

  const line = [
    `${COLORS.dim}${timestamp()}${COLORS.reset}`,
    `${color}${COLORS.bold}[${label}]${COLORS.reset}`,
    `${color}${message}${COLORS.reset}`,
    extra !== undefined ? formatExtra(extra) : '',
  ].join(' ');

  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

const logger = {
  info:  (...args) => log('info',  ...args),
  warn:  (...args) => log('warn',  ...args),
  error: (...args) => log('error', ...args),
  debug: (...args) => log('debug', ...args),
};

export default logger;

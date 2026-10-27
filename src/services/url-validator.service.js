import dns from 'dns';
import ipaddr from 'ipaddr.js';
import { ForbiddenDestinationError, ValidationError } from '../utils/errors.js';

// Blocked IPv4 ranges
const IPV4_PROHIBITED_RANGES = {
  unspecified: [ipaddr.parseCIDR('0.0.0.0/8')],
  broadcast: [ipaddr.parseCIDR('255.255.255.255/32')],
  multicast: [ipaddr.parseCIDR('224.0.0.0/4')],
  linkLocal: [ipaddr.parseCIDR('169.254.0.0/16')], // Cloud metadata endpoints (169.254.169.254)
  loopback: [ipaddr.parseCIDR('127.0.0.0/8')],
  private_10: [ipaddr.parseCIDR('10.0.0.0/8')],
  private_172: [ipaddr.parseCIDR('172.16.0.0/12')],
  private_192: [ipaddr.parseCIDR('192.168.0.0/16')],
  carrierGradeNat: [ipaddr.parseCIDR('100.64.0.0/10')], // CGNAT / metadata (e.g. 100.100.100.200)
  documentation_192: [ipaddr.parseCIDR('192.0.2.0/24')],
  documentation_198: [ipaddr.parseCIDR('198.51.100.0/24')],
  documentation_203: [ipaddr.parseCIDR('203.0.113.0/24')],
  benchmarking: [ipaddr.parseCIDR('198.18.0.0/15')],
  reserved: [ipaddr.parseCIDR('240.0.0.0/4')]
};

// Blocked IPv6 ranges
const IPV6_PROHIBITED_RANGES = {
  unspecified: [ipaddr.parseCIDR('::/128')],
  linkLocal: [ipaddr.parseCIDR('fe80::/10')],
  multicast: [ipaddr.parseCIDR('ff00::/8')],
  loopback: [ipaddr.parseCIDR('::1/128')],
  uniqueLocal: [ipaddr.parseCIDR('fc00::/7')],
  documentation: [ipaddr.parseCIDR('2001:db8::/32')],
  discard: [ipaddr.parseCIDR('100::/64')]
};

// Blocked hostnames and suffixes
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.internal',
  'instance-data',
  'instance-data.ec2.internal'
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  '.local',
  '.internal',
  '.onion',
  '.lan',
  '.home',
  '.corp',
  '.localdomain'
];

/**
 * Checks if a parsed IP address falls within prohibited/private/loopback ranges.
 * @param {ipaddr.IPv4|ipaddr.IPv6} addr
 * @param {object} [options]
 * @param {boolean} [options.allowLocalTest=false]
 * @returns {boolean} True if prohibited
 */
export function isProhibitedIpAddress(addr, options = {}) {
  const allowLocalTest = options.allowLocalTest || false;

  // If IPv6 is mapped IPv4 (::ffff:127.0.0.1), unmap it and check IPv4 ranges
  if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
    const v4 = addr.toIPv4Address();
    return isProhibitedIpAddress(v4, options);
  }

  // During internal testing with allowLocalTest, loopback (127.0.0.0/8, ::1) is permitted for test mocks
  if (allowLocalTest) {
    if (addr.kind() === 'ipv4' && ipaddr.subnetMatch(addr, { loopback: IPV4_PROHIBITED_RANGES.loopback }, 'public') !== 'public') {
      return false;
    }
    if (addr.kind() === 'ipv6' && addr.toNormalizedString() === '::1') {
      return false;
    }
  }

  if (addr.kind() === 'ipv4') {
    const match = ipaddr.subnetMatch(addr, IPV4_PROHIBITED_RANGES, 'public');
    return match !== 'public';
  }

  if (addr.kind() === 'ipv6') {
    const match = ipaddr.subnetMatch(addr, IPV6_PROHIBITED_RANGES, 'public');
    return match !== 'public';
  }

  return true;
}

/**
 * Validates an IP string against prohibited ranges.
 * @param {string} ipStr
 * @param {object} [options]
 * @param {boolean} [options.allowLocalTest=false]
 * @returns {boolean} True if prohibited
 */
export function isProhibitedIp(ipStr, options = {}) {
  if (!ipStr || typeof ipStr !== 'string') return true;
  if (!ipaddr.isValid(ipStr)) {
    // If it is a domain name rather than an IP literal, it is not an IP
    return false;
  }
  try {
    const parsed = ipaddr.parse(ipStr);
    return isProhibitedIpAddress(parsed, options);
  } catch {
    return true;
  }
}

/**
 * Validates a URL string for syntactic safety, scheme, credentials, and hostname.
 * @param {string} rawUrl
 * @returns {URL} Parsed URL object
 */
export function validateUrlSyntax(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new ValidationError('A URL string must be provided.');
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length > 2048) {
    throw new ValidationError('URL exceeds maximum permitted length of 2048 characters.');
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ValidationError('The supplied string is not a valid URL.');
  }

  // Scheme validation: strictly HTTP or HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError(`Unsupported URL scheme: "${parsed.protocol}". Only HTTP and HTTPS are permitted.`);
  }

  // Reject embedded credentials
  if (parsed.username || parsed.password) {
    throw new ValidationError('URLs containing embedded credentials (username/password) are strictly prohibited.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    throw new ValidationError('URL must include a valid hostname.');
  }

  // Check blocked hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new ForbiddenDestinationError(`Access to hostname "${hostname}" is prohibited.`);
  }

  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      throw new ForbiddenDestinationError(`Access to private domain suffix "${suffix}" is prohibited.`);
    }
  }

  return parsed;
}

/**
 * Resolves a hostname via DNS and validates that none of the resolved IPs are in prohibited ranges.
 * @param {string} hostname
 * @param {object} [options]
 * @param {boolean} [options.allowLocalTest] Allow loopback specifically during internal mock tests
 * @returns {Promise<Array<{ address: string, family: number }>>} Validated resolved addresses
 */
export async function resolveAndValidateDns(hostname, options = {}) {
  const allowLocalTest = options.allowLocalTest || false;

  // Check if hostname is already a raw IP
  if (ipaddr.isValid(hostname)) {
    if (isProhibitedIp(hostname, { allowLocalTest })) {
      throw new ForbiddenDestinationError(`The target IP address "${hostname}" is in a prohibited range.`);
    }
    const parsed = ipaddr.parse(hostname);
    return [{
      address: hostname,
      family: parsed.kind() === 'ipv6' ? 6 : 4
    }];
  }

  let records;
  try {
    records = await dns.promises.lookup(hostname, { all: true });
  } catch (err) {
    throw new ValidationError(`DNS resolution failed for hostname "${hostname}": ${err.message}`);
  }

  if (!records || records.length === 0) {
    throw new ValidationError(`Could not resolve any IP addresses for hostname "${hostname}".`);
  }

  for (const rec of records) {
    if (isProhibitedIp(rec.address, { allowLocalTest })) {
      throw new ForbiddenDestinationError(`Destination resolved to prohibited IP address "${rec.address}".`);
    }
  }

  return records;
}

export default {
  validateUrlSyntax,
  resolveAndValidateDns,
  isProhibitedIp,
  isProhibitedIpAddress
};

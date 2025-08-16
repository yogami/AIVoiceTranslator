import { Request, Response, NextFunction } from 'express';

function parseAllowedIps(): string[] {
  const raw = process.env.ALLOWED_IPS || '';
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function getClientIp(req: Request): string {
  const header = (req.headers['x-forwarded-for'] as string) || '';
  const forwarded = header.split(',')[0]?.trim();
  const direct = (req.ip || (req.connection as any)?.remoteAddress || '') as string;
  return forwarded || direct || '';
}

function isIpAllowed(clientIp: string, allowedIps: string[]): boolean {
  if (!allowedIps.length) return true; // No restrictions configured
  if (!clientIp) return false;
  // Support exact IPs and simple wildcard prefixes like "192.168.*"
  return allowedIps.some(allowed => {
    if (allowed.endsWith('.*')) {
      const prefix = allowed.slice(0, -1); // keep the dot to avoid partials
      return clientIp.startsWith(prefix);
    }
    return clientIp === allowed;
  });
}

export function restrictToAllowedIPs(req: Request, res: Response, next: NextFunction) {
  const allowedIps = parseAllowedIps();
  if (!allowedIps.length) return next();
  const clientIp = getClientIp(req);
  if (isIpAllowed(clientIp, allowedIps)) return next();
  return res.status(403).json({ error: 'Access denied: IP not authorized' });
}



import { Request, Response, NextFunction } from 'express';

function isBetaEnabled(): boolean {
  const flag = (process.env.BETA_ENABLED || '1').toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes' || flag === 'on';
}

export function betaGate(req: Request, res: Response, next: NextFunction) {
  if (!isBetaEnabled()) return next();
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const betaToken = process.env.BETA_ACCESS_TOKEN || '';
  if (!betaToken) return res.status(503).json({ error: 'Service temporarily unavailable (beta locked).' });
  if (bearer === betaToken) return next();
  return res.status(401).json({ error: 'Beta access required' });
}



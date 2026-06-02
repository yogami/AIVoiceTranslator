/**
 * Audit Routes
 *
 * REST endpoints for inspecting the governance compliance ledger.
 * Provides read-only access to audit receipts, chain verification,
 * and summary statistics.
 */

import { Router, Request, Response } from 'express';
import { ComplianceLedger } from '../domain/governance/ComplianceLedger';

export function createAuditRoutes(): Router {
  const router = Router();

  /**
   * GET /api/audit/ledger
   * Returns the full compliance ledger as JSON.
   */
  router.get('/audit/ledger', (_req: Request, res: Response) => {
    console.log('[AuditRoutes] GET /api/audit/ledger');
    const ledger = ComplianceLedger.getLedger();
    res.json(ledger);
  });

  /**
   * GET /api/audit/ledger/verify
   * Verifies the integrity of the hash chain and returns the result.
   */
  router.get('/audit/ledger/verify', (_req: Request, res: Response) => {
    console.log('[AuditRoutes] GET /api/audit/ledger/verify');
    const result = ComplianceLedger.verifyChainIntegrity();
    res.json(result);
  });

  /**
   * GET /api/audit/ledger/stats
   * Returns summary statistics: chain length, passed count, failed count.
   */
  router.get('/audit/ledger/stats', (_req: Request, res: Response) => {
    console.log('[AuditRoutes] GET /api/audit/ledger/stats');
    const ledger = ComplianceLedger.getLedger();
    const chainLength = ComplianceLedger.getChainLength();
    const passedCount = ledger.filter(r => r.status === 'PASSED').length;
    const failedCount = ledger.filter(r => r.status === 'FAILED').length;
    res.json({ chainLength, passedCount, failedCount });
  });

  return router;
}

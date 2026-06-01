import crypto from 'crypto';

export interface AuditReceipt {
  timestamp: string;
  agentActionType: string;
  ltlRulesChecked: string[];
  euAiActClause: string;
  status: 'PASSED' | 'FAILED';
  hash: string;
  details: string;
}

export class ComplianceLedger {
  private static ledger: AuditReceipt[] = [];

  public static generateReceipt(actionType: string, ltlRules: string[], euClause: string, status: 'PASSED'|'FAILED', details: string): AuditReceipt {
    const timestamp = new Date().toISOString();
    
    // Create deterministic hash of the event
    const dataString = `${timestamp}|${actionType}|${ltlRules.join(',')}|${euClause}|${status}|${details}`;
    const hash = crypto.createHash('sha256').update(dataString).digest('hex');

    const receipt: AuditReceipt = {
      timestamp,
      agentActionType: actionType,
      ltlRulesChecked: ltlRules,
      euAiActClause: euClause,
      status,
      hash,
      details
    };

    // Store in memory (in prod this would be a DB or blockchain)
    this.ledger.push(receipt);
    
    return receipt;
  }

  public static getLedger(): AuditReceipt[] {
    return this.ledger;
  }
}

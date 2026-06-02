import crypto from 'crypto';

export interface AuditReceipt {
  timestamp: string;
  agentActionType: string;
  ltlRulesChecked: string[];
  euAiActClause: string;
  status: 'PASSED' | 'FAILED';
  hash: string;
  previousHash: string;
  details: string;
}

export class ComplianceLedger {
  private static ledger: AuditReceipt[] = [];

  public static generateReceipt(actionType: string, ltlRules: string[], euClause: string, status: 'PASSED'|'FAILED', details: string): AuditReceipt {
    const timestamp = new Date().toISOString();
    
    // Chain hash: include previous receipt's hash (or GENESIS for the first entry)
    const previousHash = this.ledger.length > 0
      ? this.ledger[this.ledger.length - 1].hash
      : 'GENESIS';

    // Create deterministic hash including the previous hash for chain integrity
    const dataString = `${previousHash}|${timestamp}|${actionType}|${ltlRules.join(',')}|${euClause}|${status}|${details}`;
    const hash = crypto.createHash('sha256').update(dataString).digest('hex');

    const receipt: AuditReceipt = {
      timestamp,
      agentActionType: actionType,
      ltlRulesChecked: ltlRules,
      euAiActClause: euClause,
      status,
      hash,
      previousHash,
      details
    };

    // Store in memory (in prod this would be a DB or blockchain)
    this.ledger.push(receipt);
    
    console.log(`[ComplianceLedger] Receipt #${this.ledger.length} chained (prevHash=${previousHash.substring(0, 8)}… → hash=${hash.substring(0, 8)}…) status=${status}`);
    
    return receipt;
  }

  public static getLedger(): AuditReceipt[] {
    return this.ledger;
  }

  /**
   * Returns the number of receipts in the chain.
   */
  public static getChainLength(): number {
    return this.ledger.length;
  }

  /**
   * Walk the ledger chain and verify that each receipt's hash is correctly
   * linked to the previous receipt. Returns an object describing the result.
   */
  public static verifyChainIntegrity(): { valid: boolean; length: number; brokenAt?: number; message: string } {
    if (this.ledger.length === 0) {
      return { valid: true, length: 0, message: 'Ledger is empty — nothing to verify.' };
    }

    for (let i = 0; i < this.ledger.length; i++) {
      const receipt = this.ledger[i];

      // Verify previousHash pointer
      const expectedPrevHash = i === 0 ? 'GENESIS' : this.ledger[i - 1].hash;
      if (receipt.previousHash !== expectedPrevHash) {
        console.log(`[ComplianceLedger] ⛔ Chain broken at index ${i}: expected prevHash=${expectedPrevHash.substring(0, 8)}…, got ${receipt.previousHash.substring(0, 8)}…`);
        return {
          valid: false,
          length: this.ledger.length,
          brokenAt: i,
          message: `Chain integrity violation at receipt index ${i}: previousHash mismatch.`
        };
      }

      // Recompute the hash and verify it matches
      const dataString = `${receipt.previousHash}|${receipt.timestamp}|${receipt.agentActionType}|${receipt.ltlRulesChecked.join(',')}|${receipt.euAiActClause}|${receipt.status}|${receipt.details}`;
      const recomputedHash = crypto.createHash('sha256').update(dataString).digest('hex');
      if (receipt.hash !== recomputedHash) {
        console.log(`[ComplianceLedger] ⛔ Chain broken at index ${i}: hash tampered.`);
        return {
          valid: false,
          length: this.ledger.length,
          brokenAt: i,
          message: `Chain integrity violation at receipt index ${i}: hash does not match recomputed value (possible tampering).`
        };
      }
    }

    console.log(`[ComplianceLedger] ✅ Chain integrity verified — ${this.ledger.length} receipts valid.`);
    return {
      valid: true,
      length: this.ledger.length,
      message: `All ${this.ledger.length} receipts verified — chain integrity intact.`
    };
  }
}

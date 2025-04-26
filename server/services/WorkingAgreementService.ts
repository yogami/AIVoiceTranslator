/**
 * Working Agreement Service
 * 
 * This service loads and provides access to the Working Agreement document
 * which guides the agent's behavior according to Software Craftsmanship principles.
 */

import { assetService } from './AssetService';

class WorkingAgreementService {
  private workingAgreementContent: string | null = null;
  private lastLoadTime: Date | null = null;
  private isLoaded: boolean = false;

  /**
   * Load the Working Agreement from the database
   * @returns True if loading was successful, false otherwise
   */
  public async loadWorkingAgreement(): Promise<boolean> {
    try {
      console.log('Loading Working Agreement from database...');
      const workingAgreement = await assetService.getWorkingAgreement();
      
      if (!workingAgreement) {
        console.error('Working Agreement not found in database!');
        return false;
      }
      
      this.workingAgreementContent = workingAgreement.content;
      this.lastLoadTime = new Date();
      this.isLoaded = true;
      
      console.log('Working Agreement loaded successfully.');
      return true;
    } catch (error) {
      console.error('Failed to load Working Agreement:', error);
      return false;
    }
  }

  /**
   * Check if the Working Agreement has been loaded
   */
  public isWorkingAgreementLoaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Get the Working Agreement content
   * Loads the agreement first if it hasn't been loaded yet
   */
  public async getWorkingAgreement(): Promise<string | null> {
    if (!this.isLoaded) {
      const success = await this.loadWorkingAgreement();
      if (!success) {
        return null;
      }
    }
    return this.workingAgreementContent;
  }

  /**
   * Extract a specific section from the Working Agreement
   * @param sectionName The name of the section to extract (e.g., "Problem Understanding Phase")
   */
  public async getSection(sectionName: string): Promise<string | null> {
    const content = await this.getWorkingAgreement();
    if (!content) {
      return null;
    }

    // Find the section heading
    const sectionRegex = new RegExp(`## [\\d\\.]+ ${sectionName}[\\s\\S]*?(?=\\n## [\\d\\.]+ |$)`, 'i');
    const match = content.match(sectionRegex);
    
    return match ? match[0].trim() : null;
  }

  /**
   * Get the master workflow summary from the Working Agreement
   */
  public async getMasterWorkflow(): Promise<string | null> {
    const content = await this.getWorkingAgreement();
    if (!content) {
      return null;
    }

    // Find the Master Workflow Summary section
    const workflowRegex = /# Master Workflow Summary\s*\n\s*```[\s\S]*?```/;
    const match = content.match(workflowRegex);
    
    return match ? match[0].trim() : null;
  }

  /**
   * Get the Agent Behavioral Principles from the Working Agreement
   */
  public async getBehavioralPrinciples(): Promise<string | null> {
    const content = await this.getWorkingAgreement();
    if (!content) {
      return null;
    }

    // Find the Agent Behavioral Principles section
    const principlesRegex = /# Agent Behavioral Principles[\s\S]*?(?=\n# |$)/;
    const match = content.match(principlesRegex);
    
    return match ? match[0].trim() : null;
  }
}

// Export a singleton instance
export const workingAgreementService = new WorkingAgreementService();
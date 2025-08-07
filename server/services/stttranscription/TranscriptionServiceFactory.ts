// Export the ISTTTranscriptionService interface from translation interfaces for use in the stttranscription package
export type { ISTTTranscriptionService } from '../translation/translation.interfaces';

import { AutoFallbackSTTService } from './AutoFallbackSTTService';

// Returns a new instance of the main STT service (AutoFallbackSTTService)
export function getSTTTranscriptionService() {
  return new AutoFallbackSTTService();
}

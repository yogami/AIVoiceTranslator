function flag(name: string): boolean {
  const v = (process.env[name] || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export const FeatureFlags = {
  // Master ACE flag: governs simplification/chunking, glossary term‑locking, slow‑repeat, and HUD hints
  ACE: flag('FEATURE_ACE'),
  MANUAL_TRANSLATION_CONTROL: flag('FEATURE_MANUAL_TRANSLATION_CONTROL'),
  LIVE_COMPREHENSION_INDICATORS: flag('FEATURE_LIVE_COMPREHENSION_INDICATORS'),
  LOW_LITERACY_MODE: flag('FEATURE_LOW_LITERACY_MODE'),
  CLASSROOM_MODES: flag('FEATURE_CLASSROOM_MODES'),
  REDACT_PROFANITY: flag('FEATURE_REDACT_PROFANITY'),
  REDACT_PII: flag('FEATURE_REDACT_PII'),
};

// Backward compatibility: when ACE is on, implicitly enable related sub‑features
if (FeatureFlags.ACE) {
  (FeatureFlags as any).LIVE_COMPREHENSION_INDICATORS = true;
  (FeatureFlags as any).LOW_LITERACY_MODE = true;
}



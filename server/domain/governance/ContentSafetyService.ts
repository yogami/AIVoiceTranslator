import OpenAI from 'openai';

/**
 * ContentSafetyService — Deterministic content verification for AgentVerify
 * 
 * Two independent verification layers:
 * 1. OpenAI Moderation API — catches hate, violence, sexual, self-harm (FREE, classifier-based)
 * 2. Embedding cosine similarity — catches off-topic content vs approved curriculum scope
 * 
 * Neither layer uses a generative LLM. Both are deterministic for the same input.
 */

export interface ModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  categoryScores: Record<string, number>;
  highestCategory: string;
  highestScore: number;
}

export interface ScopeResult {
  inScope: boolean;
  similarityScore: number;
  threshold: number;
  closestTopic: string;
  curriculumScope: string;
}

export interface ContentVerificationResult {
  safe: boolean;
  moderation: ModerationResult;
  scope: ScopeResult;
  verificationMethods: string[];
  failureReasons: string[];
}

// Pre-defined curriculum scope for demo
const DEFAULT_CURRICULUM: string[] = [
  'biology', 'life sciences', 'photosynthesis', 'osmosis', 'cell biology',
  'mitosis', 'meiosis', 'DNA', 'genetics', 'evolution', 'ecology',
  'anatomy', 'physiology', 'microbiology', 'biochemistry',
  'organisms', 'plants', 'animals', 'ecosystems', 'respiration',
  'enzymes', 'proteins', 'metabolism', 'diffusion', 'homeostasis'
];

export class ContentSafetyService {
  private static openai: OpenAI | null = null;
  private static curriculumEmbeddings: Map<string, number[]> = new Map();
  private static embeddingsInitialized = false;

  private static getClient(): OpenAI {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY not set');
      this.openai = new OpenAI({ apiKey });
    }
    return this.openai;
  }

  /**
   * Initialize curriculum embeddings (cached after first call)
   */
  private static async ensureCurriculumEmbeddings(topics: string[] = DEFAULT_CURRICULUM): Promise<void> {
    if (this.embeddingsInitialized) return;

    try {
      const client = this.getClient();
      // Batch all topics into a single embedding call
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: topics
      });

      for (let i = 0; i < topics.length; i++) {
        this.curriculumEmbeddings.set(topics[i], response.data[i].embedding);
      }

      this.embeddingsInitialized = true;
      console.log(`[ContentSafetyService] Cached ${topics.length} curriculum embeddings`);
    } catch (e) {
      console.warn('[ContentSafetyService] Failed to initialize curriculum embeddings:', e);
    }
  }

  /**
   * Layer 1: OpenAI Moderation API (FREE, classifier-based, not generative)
   */
  static async checkModeration(text: string): Promise<ModerationResult> {
    try {
      const client = this.getClient();
      const response = await client.moderations.create({ input: text });
      const result = response.results[0];

      // Find highest scoring category
      const scores = result.category_scores as unknown as Record<string, number>;
      const categories = result.categories as unknown as Record<string, boolean>;
      let highestCategory = 'none';
      let highestScore = 0;

      for (const [cat, score] of Object.entries(scores)) {
        if (score > highestScore) {
          highestScore = score;
          highestCategory = cat;
        }
      }

      return {
        flagged: result.flagged,
        categories,
        categoryScores: scores,
        highestCategory,
        highestScore
      };
    } catch (e) {
      console.warn('[ContentSafetyService] Moderation API call failed:', e);
      // Fail-open: don't block if the API is down
      return {
        flagged: false,
        categories: {},
        categoryScores: {},
        highestCategory: 'error',
        highestScore: 0
      };
    }
  }

  /**
   * Layer 2: Embedding cosine similarity for curriculum scope checking
   */
  static async checkCurriculumScope(text: string, threshold: number = 0.35): Promise<ScopeResult> {
    try {
      await this.ensureCurriculumEmbeddings();

      if (this.curriculumEmbeddings.size === 0) {
        // If embeddings failed to load, fail-open
        return { inScope: true, similarityScore: 1, threshold, closestTopic: 'unknown', curriculumScope: 'Biology / Life Sciences' };
      }

      const client = this.getClient();
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text
      });
      const textEmbedding = response.data[0].embedding;

      // Find highest cosine similarity against curriculum topics
      let closestTopic = '';
      let maxSimilarity = -1;

      for (const [topic, topicEmbedding] of this.curriculumEmbeddings.entries()) {
        const similarity = this.cosineSimilarity(textEmbedding, topicEmbedding);
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          closestTopic = topic;
        }
      }

      const inScope = maxSimilarity >= threshold;
      console.log(`[ContentSafetyService] Scope check: similarity=${maxSimilarity.toFixed(4)}, threshold=${threshold}, closest="${closestTopic}", inScope=${inScope}`);

      return {
        inScope,
        similarityScore: Math.round(maxSimilarity * 10000) / 10000,
        threshold,
        closestTopic,
        curriculumScope: 'Biology / Life Sciences'
      };
    } catch (e) {
      console.warn('[ContentSafetyService] Scope check failed:', e);
      return { inScope: true, similarityScore: 1, threshold, closestTopic: 'error', curriculumScope: 'Biology / Life Sciences' };
    }
  }

  /**
   * Run both verification layers in parallel
   */
  static async verifyContent(text: string): Promise<ContentVerificationResult> {
    const [moderation, scope] = await Promise.all([
      this.checkModeration(text),
      this.checkCurriculumScope(text)
    ]);

    const failureReasons: string[] = [];

    if (moderation.flagged) {
      failureReasons.push(`Content safety violation: ${moderation.highestCategory} (score: ${moderation.highestScore.toFixed(4)})`);
    }

    if (!scope.inScope) {
      failureReasons.push(`Curriculum scope violation: similarity ${scope.similarityScore.toFixed(4)} < threshold ${scope.threshold} (closest topic: "${scope.closestTopic}")`);
    }

    return {
      safe: failureReasons.length === 0,
      moderation,
      scope,
      verificationMethods: [
        'OpenAI Moderation API (classifier)',
        `Embedding cosine similarity (text-embedding-3-small, threshold=${scope.threshold})`
      ],
      failureReasons
    };
  }

  /**
   * Cosine similarity between two vectors
   */
  private static cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

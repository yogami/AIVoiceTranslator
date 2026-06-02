import { ITranslationService } from './translation.interfaces';
import { OpenAI } from 'openai';

export class OpenAITranslationService implements ITranslationService {
  private openai: OpenAI;

  constructor(openai: OpenAI) {
    this.openai = openai;
  }

  async translate(text: string, sourceLang: string, targetLang: string): Promise<string | { text: string; agentActions?: any[] }> {
    try {
      const tools: any[] = [
        {
          type: 'function',
          function: {
            name: 'generate_quiz',
            description: 'Generate a quick multiple-choice quiz based on the teacher\'s recent transcript to check student understanding.',
            parameters: {
              type: 'object',
              properties: {
                question: { type: 'string', description: 'The quiz question.' },
                options: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of 3-4 possible answers.'
                },
                correctAnswer: { type: 'string', description: 'The correct answer exactly matching one of the options.' }
              },
              required: ['question', 'options', 'correctAnswer']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'extract_vocabulary',
            description: 'Identify 1-3 complex or important terms in the transcript and provide their definitions in the target language.',
            parameters: {
              type: 'object',
              properties: {
                terms: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      term: { type: 'string', description: 'The difficult word or phrase.' },
                      definition: { type: 'string', description: `The definition of the term translated into ${targetLang}.` }
                    },
                    required: ['term', 'definition']
                  }
                }
              },
              required: ['terms']
            }
          }
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `You are an autonomous Teacher's Assistant and Translator.
First, YOU MUST ALWAYS translate the provided text from ${sourceLang} to ${targetLang}. Your direct text response MUST be ONLY the literal translation of the teacher's words. Do not include commentary in your text response.
Second, if the teacher has just explained a complex concept, you may autonomously call the 'generate_quiz' tool.
Third, if the teacher used difficult jargon, you may autonomously call the 'extract_vocabulary' tool.` 
          },
          { role: 'user', content: text }
        ],
        tools: tools,
        tool_choice: (() => {
          const forceActions = process.env.FORCE_AGENT_ACTIONS;
          if (forceActions === 'true' || forceActions === '1') {
            console.log('[OpenAITranslationService] FORCE_AGENT_ACTIONS enabled — using tool_choice: required');
            return 'required' as const;
          }
          return 'auto' as const;
        })(),
        temperature: 0.3
      });

      const choice = response.choices[0];
      let translation = choice?.message?.content?.trim() || '';
      
      const agentActions: any[] = [];
      if (choice.message.tool_calls) {
        for (const toolCall of choice.message.tool_calls) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            if (toolCall.function.name === 'generate_quiz') {
              agentActions.push({ type: 'quiz', payload: args });
            } else if (toolCall.function.name === 'extract_vocabulary') {
              agentActions.push({ type: 'vocabulary', payload: args });
            }
          } catch (e) {
            console.error('[OpenAITranslationService] Failed to parse tool call args', e);
          }
        }
      }

      // When OpenAI returns tool calls, content is often null.
      // Make a fast follow-up call just for the translation text.
      if (!translation && agentActions.length > 0) {
        console.log('[OpenAITranslationService] Tool calls returned but content was empty — fetching translation separately');
        try {
          const fallbackResponse = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: `Translate the following text from ${sourceLang} to ${targetLang}. Respond with ONLY the translation, nothing else.` },
              { role: 'user', content: text }
            ],
            temperature: 0.3
          });
          translation = fallbackResponse.choices[0]?.message?.content?.trim() || text;
        } catch (fallbackError) {
          console.warn('[OpenAITranslationService] Fallback translation failed, using original text', fallbackError);
          translation = text; // Last resort: use original text
        }
      }

      console.log(`[OpenAITranslationService] Result: translation="${translation.substring(0, 80)}...", agentActions=${agentActions.length}`);

      if (agentActions.length > 0) {
        return { text: translation, agentActions };
      }
      return translation;
    } catch (error) {
      throw new Error(`OpenAI translation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

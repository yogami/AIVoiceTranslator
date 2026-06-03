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
            name: 'translate_text',
            description: `Translate the teacher's message from ${sourceLang} to ${targetLang}. Return ONLY the literal translation.`,
            parameters: {
              type: 'object',
              properties: {
                translation: { type: 'string', description: `The literal translation of the teacher's message in ${targetLang}.` }
              },
              required: ['translation']
            }
          }
        },
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
            content: `You are an autonomous Teacher's Assistant. You MUST call ALL THREE tools on every message:
1. ALWAYS call 'translate_text' with the literal translation from ${sourceLang} to ${targetLang}.
2. ALWAYS call 'generate_quiz' with a comprehension question about the topic.
3. ALWAYS call 'extract_vocabulary' with key terms and definitions.
Call all three tools. This is mandatory. Never skip any tool.` 
          },
          { role: 'user', content: text }
        ],
        tools: tools,
        parallel_tool_calls: true,
        tool_choice: (() => {
          const forceActions = process.env.FORCE_AGENT_ACTIONS;
          // Default to 'required' so quiz/vocab always generate for demo
          // Set FORCE_AGENT_ACTIONS=false to revert to 'auto'
          if (forceActions === 'false' || forceActions === '0') {
            console.log('[OpenAITranslationService] FORCE_AGENT_ACTIONS=false — using tool_choice: auto');
            return 'auto' as const;
          }
          return 'required' as const;
        })(),
        temperature: 0.3
      });

      const choice = response.choices[0];
      // With translate_text as a tool, content may be null — that's expected
      let translation = choice?.message?.content?.trim() || '';
      
      const agentActions: any[] = [];
      if (choice.message.tool_calls) {
        for (const toolCall of choice.message.tool_calls) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            if (toolCall.function.name === 'translate_text') {
              // Extract translation from tool call — eliminates the need for a second API call
              translation = args.translation || translation;
            } else if (toolCall.function.name === 'generate_quiz') {
              agentActions.push({ type: 'quiz', payload: args });
            } else if (toolCall.function.name === 'extract_vocabulary') {
              agentActions.push({ type: 'vocabulary', payload: args });
            }
          } catch (e) {
            console.error('[OpenAITranslationService] Failed to parse tool call args', e);
          }
        }
      }

      // Fallback: if translation is still empty (shouldn't happen with translate_text tool)
      if (!translation) {
        console.warn('[OpenAITranslationService] translate_text tool not called, using original text as fallback');
        translation = text;
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

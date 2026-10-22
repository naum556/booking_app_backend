import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenRouter } from '@openrouter/sdk';

export interface BookingConfirmationInput {
  name: string;
  date: string;
  time: string;
  duration: number;
}

/**
 * Default model for generating booking confirmation messages.
 *
 * Note: nvidia/nemotron-3.5-lightning:free is a reasoning model that spends its
 * whole token budget on reasoning and returns empty content for short prompts,
 * so a non-reasoning free model is used instead.
 */
const DEFAULT_MODEL = 'minimax/minimax-m3.1-flash:free';

/** How long to wait for the model before falling back to a static message. */
const AI_TIMEOUT_MS = 20_000;

/** How many times to call the model before giving up and using the fallback. */
const MAX_ATTEMPTS = 2;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: OpenRouter | null;
  private readonly model: string;

  constructor(configService: ConfigService) {
    const apiKey = configService.get<string>('OPENROUTER_API_KEY');
    this.model =
      configService.get<string>('OPENROUTER_MODEL') ?? DEFAULT_MODEL;

    if (!apiKey) {
      this.logger.warn(
        'OPENROUTER_API_KEY is not set; booking confirmations will use a static message.',
      );
      this.client = null;
    } else {
      this.client = new OpenRouter({ apiKey });
    }
  }

  /**
   * Generates a short, friendly confirmation message for a newly created
   * booking. Never throws: if the model is unreachable, times out, or returns
   * nothing, a static fallback message is returned so that creating a booking
   * does not fail because of the AI call.
   *
   * Free models route to different providers and occasionally return empty
   * content, so a second attempt is made before falling back.
   */
  async generateBookingConfirmation(
    input: BookingConfirmationInput,
  ): Promise<string> {
    const fallback = this.fallbackMessage(input);

    if (!this.client) {
      return fallback;
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await this.withTimeout(
          this.client.chat.send({
            chatRequest: {
              model: this.model,
              maxTokens: 200,
              temperature: 0.7,
              stream: false as const,
              messages: [
                {
                  role: 'system',
                  content:
                    'You write booking confirmation messages. Reply with exactly one short, warm sentence (max 25 words) confirming the booking. No quotes, no emoji, no extra text.',
                },
                {
                  role: 'user',
                  content: `A booking was just made. Name: ${input.name}. Date: ${input.date}. Time: ${input.time}. Duration: ${input.duration} minutes. Write the confirmation message.`,
                },
              ],
            },
          }),
        );

        const content = result.choices?.[0]?.message?.content;
        const message =
          typeof content === 'string' ? content.trim() : undefined;

        if (message) {
          return message;
        }

        this.logger.warn(
          `OpenRouter returned an empty message (attempt ${attempt}/${MAX_ATTEMPTS}).`,
        );
      } catch (error) {
        this.logger.warn(
          `OpenRouter call failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.logger.warn('Using static fallback booking message.');
    return fallback;
  }

  private fallbackMessage(input: BookingConfirmationInput): string {
    return `Thanks ${input.name}! Your booking on ${input.date} at ${input.time} (${input.duration} minutes) is confirmed.`;
  }

  private withTimeout<T>(promise: Promise<T>, ms = AI_TIMEOUT_MS): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`OpenRouter request timed out after ${ms}ms`)),
        ms,
      );

      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error: unknown) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}

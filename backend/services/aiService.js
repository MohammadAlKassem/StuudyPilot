'use strict';

let geminiClient;
let clientApiKey;

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const PROVIDER_TIMEOUT_MS = 30000;

class AIServiceError extends Error {
  constructor(publicMessage, safeLogMessage, code) {
    super(publicMessage);
    this.name = 'AIServiceError';
    this.publicMessage = publicMessage;
    this.safeLogMessage = safeLogMessage;
    this.code = code;
  }
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new AIServiceError(
      'AI study planning is not configured',
      'Gemini API key is not configured',
      'AI_NOT_CONFIGURED',
    );
  }

  if (!geminiClient || clientApiKey !== apiKey) {
    // Load and initialize the SDK only when the AI endpoint is actually used.
    const { GoogleGenAI } = require('@google/genai');
    geminiClient = new GoogleGenAI({ apiKey });
    clientApiKey = apiKey;
  }

  return geminiClient;
}

function extractOutputText(response) {
  return typeof response?.text === 'string' ? response.text.trim() : '';
}

async function generateStudyPlan(prompt) {
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  let outputText;

  try {
    const client = getClient();
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        maxOutputTokens: 1200,
        responseMimeType: 'text/plain',
        httpOptions: {
          timeout: PROVIDER_TIMEOUT_MS,
        },
      },
    });

    outputText = extractOutputText(response);
  } catch (_error) {
    if (_error instanceof AIServiceError) throw _error;

    throw new AIServiceError(
      'AI study planning is temporarily unavailable',
      'AI provider request failed',
      'AI_PROVIDER_UNAVAILABLE',
    );
  }

  if (!outputText) {
    throw new AIServiceError(
      'AI study planning returned no usable response',
      'AI provider returned an empty response',
      'AI_EMPTY_RESPONSE',
    );
  }

  if (outputText.length > 12000) {
    throw new AIServiceError(
      'AI study planning returned an unusable response',
      'AI provider response exceeded the safe length limit',
      'AI_RESPONSE_TOO_LARGE',
    );
  }

  return outputText;
}

module.exports = {
  AIServiceError,
  generateStudyPlan,
};

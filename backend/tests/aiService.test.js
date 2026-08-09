'use strict';

const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');

const servicePath = require.resolve('../services/aiService');
const sdkPath = require.resolve('@google/genai');
const realSdkExports = require('@google/genai');
const originalApiKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_MODEL;

function restoreEnvironment(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function loadService() {
  delete require.cache[servicePath];
  return require(servicePath);
}

function loadServiceWithProvider(generateContent) {
  const calls = {
    clientOptions: [],
    requests: [],
  };

  class FakeGoogleGenAI {
    constructor(options) {
      calls.clientOptions.push(options);
      this.models = {
        generateContent: async (request) => {
          calls.requests.push(request);
          return generateContent(request);
        },
      };
    }
  }

  require.cache[sdkPath].exports = { GoogleGenAI: FakeGoogleGenAI };

  return {
    calls,
    service: loadService(),
  };
}

afterEach(() => {
  restoreEnvironment('GEMINI_API_KEY', originalApiKey);
  restoreEnvironment('GEMINI_MODEL', originalModel);
  require.cache[sdkPath].exports = realSdkExports;
  delete require.cache[servicePath];
});

test('AI generation fails safely and clearly when no Gemini API key is configured', async () => {
  delete process.env.GEMINI_API_KEY;

  const { AIServiceError, generateStudyPlan } = loadService();

  await assert.rejects(
    generateStudyPlan('Create a study plan'),
    (error) => {
      assert.ok(error instanceof AIServiceError);
      assert.equal(error.code, 'AI_NOT_CONFIGURED');
      assert.equal(error.publicMessage, 'AI study planning is not configured');
      assert.equal(error.safeLogMessage, 'Gemini API key is not configured');
      assert.equal(error.message.includes('key='), false);
      return true;
    },
  );
});

test('Gemini generation returns trimmed plain text with the configured model and timeout', async () => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.GEMINI_MODEL = 'gemini-test-model';

  const { calls, service } = loadServiceWithProvider(async () => ({
    text: '  Objective: Understand promises.\n\n1. Review the event loop.  ',
  }));

  const plan = await service.generateStudyPlan('Create a study plan');

  assert.equal(plan, 'Objective: Understand promises.\n\n1. Review the event loop.');
  assert.deepEqual(calls.clientOptions, [{ apiKey: 'test-gemini-key' }]);
  assert.equal(calls.requests.length, 1);
  assert.equal(calls.requests[0].model, 'gemini-test-model');
  assert.equal(calls.requests[0].contents, 'Create a study plan');
  assert.deepEqual(calls.requests[0].config, {
    maxOutputTokens: 1200,
    responseMimeType: 'text/plain',
    httpOptions: { timeout: 30000 },
  });
  assert.equal('responseSchema' in calls.requests[0].config, false);
  assert.equal('responseJsonSchema' in calls.requests[0].config, false);
});

test('Gemini generation defaults to gemini-3.5-flash-lite and reuses its keyed client', async () => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  delete process.env.GEMINI_MODEL;

  const { calls, service } = loadServiceWithProvider(async () => ({ text: 'Study plan' }));

  await service.generateStudyPlan('First prompt');
  await service.generateStudyPlan('Second prompt');

  assert.equal(calls.clientOptions.length, 1);
  assert.deepEqual(
    calls.requests.map(({ model }) => model),
    ['gemini-3.5-flash-lite', 'gemini-3.5-flash-lite'],
  );
});

test('Gemini provider failures are mapped to a fixed safe error without leaking details', async () => {
  process.env.GEMINI_API_KEY = 'test-gemini-secret';

  const { service } = loadServiceWithProvider(async () => {
    throw new Error('Provider rejected test-gemini-secret with a raw diagnostic');
  });

  await assert.rejects(
    service.generateStudyPlan('Create a study plan'),
    (error) => {
      assert.ok(error instanceof service.AIServiceError);
      assert.equal(error.code, 'AI_PROVIDER_UNAVAILABLE');
      assert.equal(error.publicMessage, 'AI study planning is temporarily unavailable');
      assert.equal(error.safeLogMessage, 'AI provider request failed');
      assert.equal(error.message.includes('test-gemini-secret'), false);
      assert.equal(error.safeLogMessage.includes('raw diagnostic'), false);
      return true;
    },
  );
});

test('Gemini blank responses preserve the empty-response safety contract', async () => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';

  const { service } = loadServiceWithProvider(async () => ({ text: '   ' }));

  await assert.rejects(
    service.generateStudyPlan('Create a study plan'),
    (error) => {
      assert.ok(error instanceof service.AIServiceError);
      assert.equal(error.code, 'AI_EMPTY_RESPONSE');
      assert.equal(error.publicMessage, 'AI study planning returned no usable response');
      assert.equal(error.safeLogMessage, 'AI provider returned an empty response');
      return true;
    },
  );
});

test('Gemini responses above the safe storage limit are rejected', async () => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';

  const { service } = loadServiceWithProvider(async () => ({ text: 'x'.repeat(12001) }));

  await assert.rejects(
    service.generateStudyPlan('Create a study plan'),
    (error) => {
      assert.ok(error instanceof service.AIServiceError);
      assert.equal(error.code, 'AI_RESPONSE_TOO_LARGE');
      assert.equal(error.publicMessage, 'AI study planning returned an unusable response');
      assert.equal(
        error.safeLogMessage,
        'AI provider response exceeded the safe length limit',
      );
      return true;
    },
  );
});

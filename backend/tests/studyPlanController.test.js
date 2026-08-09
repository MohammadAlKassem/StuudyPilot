'use strict';

const { after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');

const originalApiKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_MODEL;
delete process.env.GEMINI_API_KEY;

const databasePath = require.resolve('../config/database');
const aiServicePath = require.resolve('../services/aiService');
const controllerPath = require.resolve('../controllers/studyPlanController');
const realDatabase = require(databasePath);
const realAiService = require(aiServicePath);

let calls = [];
let transactionEvents = [];
let failStudyPlanInsert = false;
let generateImplementation = realAiService.generateStudyPlan;

function restoreEnvironment(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function inputValues(inputs) {
  return Object.fromEntries(inputs.map(({ name, value }) => [name, value]));
}

function createFakeRequest(source = 'pool') {
  const inputs = [];

  return {
    input(name, type, value) {
      inputs.push({ name, type, value });
      return this;
    },
    async query(queryText) {
      calls.push({ inputs: [...inputs], queryText, source });

      if (/INSERT INTO dbo\.study_plans/.test(queryText)) {
        if (failStudyPlanInsert) throw new Error('Simulated study plan insert failure');

        const values = inputValues(inputs);
        return {
          recordset: [{
            id: 41,
            subject: values.subject,
            topic: values.topic,
            difficulty: values.difficulty,
            availableMinutes: values.availableMinutes,
            deadline: values.deadline,
            generatedPlan: values.generatedPlan,
            createdAt: new Date('2026-08-07T10:00:00.000Z'),
          }],
          rowsAffected: [1],
        };
      }

      return { recordset: [], rowsAffected: [1] };
    },
  };
}

class FakeTransaction {
  async begin() {
    transactionEvents.push('begin');
  }

  async commit() {
    transactionEvents.push('commit');
  }

  async rollback() {
    transactionEvents.push('rollback');
  }
}

class FakeRequest {
  constructor() {
    return createFakeRequest('transaction');
  }
}

const fakePool = { request: () => createFakeRequest('pool') };
const fakeSql = {
  Int: 'Int',
  DateTime2: 'DateTime2',
  MAX: 'MAX',
  NVarChar: (size) => `NVarChar(${size})`,
  VarChar: (size) => `VarChar(${size})`,
  Transaction: FakeTransaction,
  Request: FakeRequest,
};

require.cache[databasePath].exports = {
  getPool: async () => fakePool,
  sql: fakeSql,
};
require.cache[aiServicePath].exports = {
  ...realAiService,
  generateStudyPlan: (...args) => generateImplementation(...args),
};
delete require.cache[controllerPath];

const { generateAndSaveStudyPlan } = require('../controllers/studyPlanController');
const AppError = require('../utils/AppError');

function createRequest(overrides = {}) {
  return {
    user: { id: 12, role: 'student' },
    body: {
      subject: 'JavaScript',
      topic: 'Promises',
      difficulty: 'hard',
      availableMinutes: 90,
      deadline: null,
    },
    ...overrides,
  };
}

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

beforeEach(() => {
  calls = [];
  transactionEvents = [];
  failStudyPlanInsert = false;
  generateImplementation = realAiService.generateStudyPlan;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
});

after(async () => {
  require.cache[databasePath].exports = realDatabase;
  require.cache[aiServicePath].exports = realAiService;
  delete require.cache[controllerPath];
  restoreEnvironment('GEMINI_API_KEY', originalApiKey);
  restoreEnvironment('GEMINI_MODEL', originalModel);
  await realDatabase.closePool();
});

test('missing Gemini configuration creates one named-parameter failed log and returns 503', async () => {
  await assert.rejects(
    generateAndSaveStudyPlan(createRequest(), {}, () => {}),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, 'AI_NOT_CONFIGURED');
      assert.equal(error.message, 'AI study planning is not configured');
      return true;
    },
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0].queryText, /INSERT INTO dbo\.ai_logs/);
  assert.match(calls[0].queryText, /@userId/);
  assert.match(calls[0].queryText, /@errorMessage/);
  assert.equal(calls[0].queryText.includes('?'), false);

  const values = inputValues(calls[0].inputs);
  assert.equal(values.userId, 12);
  assert.match(values.prompt, /Subject: "JavaScript"/);
  assert.equal(values.status, 'failed');
  assert.equal(values.errorMessage, 'Gemini API key is not configured');
  assert.equal(Object.values(values).join(' ').includes('GEMINI_API_KEY='), false);
});

test('provider failures log only the fixed safe diagnostic and never the configured key', async () => {
  const secretSentinel = 'controller-private-gemini-sentinel';
  process.env.GEMINI_API_KEY = secretSentinel;
  generateImplementation = async () => {
    throw new realAiService.AIServiceError(
      'AI study planning is temporarily unavailable',
      'AI provider request failed',
      'AI_PROVIDER_UNAVAILABLE',
    );
  };

  await assert.rejects(
    generateAndSaveStudyPlan(createRequest(), {}, () => {}),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, 'AI_PROVIDER_UNAVAILABLE');
      assert.equal(error.message, 'AI study planning is temporarily unavailable');
      assert.equal(error.message.includes(secretSentinel), false);
      return true;
    },
  );

  assert.equal(calls.length, 1);
  const values = inputValues(calls[0].inputs);
  assert.equal(values.status, 'failed');
  assert.equal(values.errorMessage, 'AI provider request failed');
  assert.equal(Object.values(values).join(' ').includes(secretSentinel), false);
  assert.equal(calls.some(({ queryText }) => /INSERT INTO dbo\.study_plans/.test(queryText)), false);
});

test('successful generation commits the AI log and study plan in one transaction', async () => {
  const generatedPlan = 'Objective: Understand promises.\n1. Review async control flow.';
  generateImplementation = async () => generatedPlan;
  const res = createResponse();

  await generateAndSaveStudyPlan(createRequest(), res, () => {});

  assert.deepEqual(transactionEvents, ['begin', 'commit']);
  assert.equal(calls.length, 2);
  assert.equal(calls.every(({ source }) => source === 'transaction'), true);
  assert.match(calls[0].queryText, /INSERT INTO dbo\.ai_logs/);
  assert.match(calls[1].queryText, /INSERT INTO dbo\.study_plans/);

  const logValues = inputValues(calls[0].inputs);
  const planValues = inputValues(calls[1].inputs);
  assert.equal(logValues.userId, 12);
  assert.equal(logValues.status, 'success');
  assert.equal(logValues.response, generatedPlan);
  assert.equal(planValues.userId, 12);
  assert.equal(planValues.subject, 'JavaScript');
  assert.equal(planValues.topic, 'Promises');
  assert.equal(planValues.generatedPlan, generatedPlan);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Study plan generated successfully');
  assert.equal(res.body.data.id, 41);
  assert.equal(res.body.data.generatedPlan, generatedPlan);
});

test('a study plan insert failure rolls back the successful AI log transaction', async () => {
  generateImplementation = async () => 'Generated study plan';
  failStudyPlanInsert = true;

  await assert.rejects(
    generateAndSaveStudyPlan(createRequest(), createResponse(), () => {}),
    /Simulated study plan insert failure/,
  );

  assert.deepEqual(transactionEvents, ['begin', 'rollback']);
  assert.equal(calls.length, 2);
  assert.match(calls[0].queryText, /INSERT INTO dbo\.ai_logs/);
  assert.match(calls[1].queryText, /INSERT INTO dbo\.study_plans/);
});

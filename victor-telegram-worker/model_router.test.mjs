import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyVictorTask, rankVictorModels } from './model_router.mjs';

test('classifies coding and reasoning tasks', () => {
  assert.equal(classifyVictorTask('', 'Fix this GitHub workflow bug and run tests'), 'coding');
  assert.equal(classifyVictorTask('', 'Find root cause why deployment failed'), 'reasoning');
});

test('prefers specialist coding model from discovered inventory', () => {
  const models = ['amazon.nova-lite-v1:0', 'qwen.qwen3-coder-next', 'deepseek.deepseek-v3'];
  const ranked = rankVictorModels(models, 'coding', {});
  assert.equal(ranked[0], 'qwen.qwen3-coder-next');
});

test('honors configured model only when discovered inventory contains it', () => {
  const env = { VICTOR_MODEL_EXECUTIVE: 'openai.gpt-enterprise' };
  const ranked = rankVictorModels(['claude.sonnet', 'openai.gpt-enterprise'], 'executive', env);
  assert.equal(ranked[0], 'openai.gpt-enterprise');
});

test('does not route embeddings as chat specialist', () => {
  const ranked = rankVictorModels(['amazon.titan-embed', 'qwen.qwen3-coder-next'], 'chat', {});
  assert.notEqual(ranked[0], 'amazon.titan-embed');
});

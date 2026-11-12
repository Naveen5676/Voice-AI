import assert from 'node:assert/strict'
import { test } from 'node:test'
import { agentFormSchema } from 'backend/validator/agent'
import { promptTemplates } from '../src/features/agents/data/prompt-templates.js'

test('validators reject blank or oversized inputs and invalid template IDs', () => {
  const value = { name: 'Willow', prompt: 'Help with everyday questions.', templateId: 'assistant' }
  for (const changes of [{ name: '   ' }, { name: 'a'.repeat(101) }, { prompt: '' }, { prompt: 'x'.repeat(12001) }, { templateId: 'unknown' }]) {
    assert.equal(agentFormSchema.safeParse({ ...value, ...changes }).success, false)
  }
  assert.equal(agentFormSchema.parse({ ...value, name: '  Willow  ' }).name, 'Willow')
})

test('all three presets provide valid editable starting points', () => {
  assert.equal(promptTemplates.length, 3)
  assert.equal(new Set(promptTemplates.map((template) => template.id)).size, 3)
  for (const template of promptTemplates) {
    assert.equal(agentFormSchema.safeParse({ name: template.title, prompt: template.prompt, templateId: template.id }).success, true)
  }
})

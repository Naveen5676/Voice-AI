import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, test } from 'node:test'
import { agentFormSchema } from 'backend/validator/agent'
import { localAgentRepository } from '../src/features/agents/data/local-agent-repository.js'
import { promptTemplates } from '../src/features/agents/data/prompt-templates.js'
import type { AgentDraft } from '../src/features/agents/types.js'

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
let storage: Map<string, string>

beforeEach(() => {
  storage = new Map()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value) },
  } })
})
afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
})

function draft(): AgentDraft {
  return { id: randomUUID(), name: 'Willow', prompt: 'Help with everyday questions.', templateId: 'assistant', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
}

test('saved drafts survive a reload and stay separate for each account', () => {
  const first = draft()
  const second = { ...draft(), name: 'Another account' }
  localAgentRepository.save('user-a', [first])
  assert.deepEqual(localAgentRepository.list('user-a'), [first])
  assert.deepEqual(localAgentRepository.list('user-b'), [])
  localAgentRepository.save('user-b', [second])
  assert.deepEqual(localAgentRepository.list('user-a'), [first])
  assert.deepEqual(localAgentRepository.list('user-b'), [second])
})

test('invalid stored data is reported without overwriting it', () => {
  localAgentRepository.save('user-a', [draft()])
  const key = [...storage.keys()][0]
  for (const value of ['not json', '[{"name":"incomplete"}]']) {
    storage.set(key, value)
    assert.throws(() => localAgentRepository.list('user-a'))
    assert.equal(storage.get(key), value)
  }
})

test('validators reject blank or oversized inputs and invalid template IDs', () => {
  const value = draft()
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

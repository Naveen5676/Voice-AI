import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mergeTranscript, receiveTranscript, type TranscriptMessage, type TranscriptStream } from '../src/features/agents/data/call-transcript.js'

const message: TranscriptMessage = { id: 'user:segment-1', role: 'user', text: 'Hello', timestamp: 100, final: false, revision: 1 }

test('interim and final streams share one bubble and late interim streams cannot overwrite final text', () => {
  let messages = mergeTranscript([], message)
  messages = mergeTranscript(messages, { ...message, text: 'Hello there', revision: 2 })
  messages = mergeTranscript(messages, { ...message, text: 'Hello there!', revision: 3, final: true })
  messages = mergeTranscript(messages, { ...message, text: 'Hello', revision: 4 })
  assert.equal(messages.length, 1)
  assert.equal(messages[0].text, 'Hello there!')
  assert.equal(messages[0].final, true)
})

test('final text remains authoritative even if streams arrive out of order', () => {
  const messages = mergeTranscript([message], { ...message, text: 'Newest interim', revision: 3 })
  assert.equal(mergeTranscript(messages, { ...message, text: 'Final correction', final: true, revision: 2 })[0].text, 'Final correction')
  assert.equal(mergeTranscript(messages, { ...message, text: 'Old interim', revision: 2 })[0].text, 'Newest interim')
})

test('stream chunks accumulate, roles follow sender identity, and segments retain first timestamps', async () => {
  let messages: TranscriptMessage[] = []
  const receive = (next: TranscriptMessage) => { messages = mergeTranscript(messages, next) }
  const stream: TranscriptStream = {
    info: { id: 'stream1', timestamp: 100, attributes: { 'lk.segment_id': 'segment1', 'lk.transcription_final': 'false' } },
    async *[Symbol.asyncIterator]() { yield 'Hello '; yield 'world'; this.info.attributes!['lk.transcription_final'] = 'true' },
  }
  await receiveTranscript(stream, 'browser', 'browser', 1, receive, new AbortController().signal)
  assert.equal(messages[0].text, 'Hello world')
  assert.equal(messages[0].role, 'user')
  assert.equal(messages[0].final, true)
  await receiveTranscript({ info: { id: 'stream2', timestamp: 200 }, async *[Symbol.asyncIterator]() { yield 'Welcome!' } }, 'agent', 'browser', 2, receive, new AbortController().signal)
  assert.equal(messages[1].role, 'assistant')
  assert.equal(messages[1].text, 'Welcome!')
})

test('aborted and broken streams neither leak late text nor erase the last words', async () => {
  const abort = new AbortController()
  const received: TranscriptMessage[] = []
  await receiveTranscript({ info: { id: 'stream', timestamp: 1 }, async *[Symbol.asyncIterator]() { yield 'Before'; abort.abort(); yield 'After' } }, 'agent', 'browser', 1, (value) => received.push(value), abort.signal)
  assert.deepEqual(received.map((value) => value.text), ['Before'])
  await receiveTranscript({ info: { id: 'broken', timestamp: 2 }, async *[Symbol.asyncIterator]() { yield 'Partial'; throw new Error('stream closed') } }, 'agent', 'browser', 2, (value) => received.push(value), new AbortController().signal)
  assert.equal(received.at(-1)?.text, 'Partial')
})

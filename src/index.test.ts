import { describe, it, expect, vi, beforeEach } from 'vitest'
import app from './index'

vi.mock('child_process', () => ({
  exec: vi.fn((cmd, callback) => {
    if (cmd.includes('今日の天気は')) {
      callback(null, { stdout: '今日は晴れです。気温は25度で過ごしやすい天気です。', stderr: '' })
    } else if (cmd.includes('Hello')) {
      callback(null, { stdout: 'Hello! How can I help you today?', stderr: '' })
    } else {
      callback(null, { stdout: 'Test response', stderr: '' })
    }
  }),
  promisify: (fn: any) => fn
}))

describe('OpenAI API Compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /v1/chat/completions', () => {
    it('should handle basic chat completion request', async () => {
      const request = new Request('http://localhost/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude',
          messages: [
            { role: 'user', content: 'Hello' }
          ]
        })
      })

      const response = await app.fetch(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('object', 'chat.completion')
      expect(data).toHaveProperty('model', 'claude')
      expect(data.choices).toHaveLength(1)
      expect(data.choices[0].message.role).toBe('assistant')
      expect(data.choices[0].message.content).toBe('Hello! How can I help you today?')
      expect(data.choices[0].finish_reason).toBe('stop')
      expect(data.usage).toHaveProperty('prompt_tokens')
      expect(data.usage).toHaveProperty('completion_tokens')
      expect(data.usage).toHaveProperty('total_tokens')
    })

    it('should handle Japanese content', async () => {
      const request = new Request('http://localhost/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude',
          messages: [
            { role: 'user', content: '今日の天気は?' }
          ]
        })
      })

      const response = await app.fetch(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.choices[0].message.content).toBe('今日は晴れです。気温は25度で過ごしやすい天気です。')
    })

    it('should handle system messages', async () => {
      const request = new Request('http://localhost/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Hello' }
          ]
        })
      })

      const response = await app.fetch(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.choices[0].message.content).toBeTruthy()
    })

    it('should return 400 for request without user message', async () => {
      const request = new Request('http://localhost/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' }
          ]
        })
      })

      const response = await app.fetch(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error', 'No user message found')
    })
  })

  describe('GET /v1/models', () => {
    it('should return available models', async () => {
      const request = new Request('http://localhost/v1/models')
      const response = await app.fetch(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('object', 'list')
      expect(data.data).toHaveLength(1)
      expect(data.data[0]).toHaveProperty('id', 'claude')
      expect(data.data[0]).toHaveProperty('object', 'model')
      expect(data.data[0]).toHaveProperty('owned_by', 'anthropic')
    })
  })
})
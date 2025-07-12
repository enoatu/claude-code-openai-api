import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { exec } from 'child_process'
import { promisify } from 'util'
import { randomUUID } from 'crypto'

const execAsync = promisify(exec)
const app = new Hono()

app.use('/*', cors())

interface ChatCompletionRequest {
  model: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: 'assistant'
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

async function executeClaude(prompt: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(`claude "${prompt.replace(/"/g, '\\"')}"`)
    if (stderr) {
      console.error('Claude stderr:', stderr)
    }
    return stdout.trim()
  } catch (error) {
    console.error('Error executing claude:', error)
    throw new Error('Failed to execute claude command')
  }
}

app.post('/v1/chat/completions', async (c) => {
  try {
    const body = await c.req.json<ChatCompletionRequest>()
    
    const lastUserMessage = body.messages
      .filter(msg => msg.role === 'user')
      .pop()
    
    if (!lastUserMessage) {
      return c.json({ error: 'No user message found' }, 400)
    }

    const systemMessages = body.messages
      .filter(msg => msg.role === 'system')
      .map(msg => msg.content)
      .join('\n')
    
    const prompt = systemMessages 
      ? `${systemMessages}\n\n${lastUserMessage.content}`
      : lastUserMessage.content

    const response = await executeClaude(prompt)
    
    const completion: ChatCompletionResponse = {
      id: `chatcmpl-${randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body.model || 'claude',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: response
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: prompt.length,
        completion_tokens: response.length,
        total_tokens: prompt.length + response.length
      }
    }

    return c.json(completion)
  } catch (error) {
    console.error('Error:', error)
    return c.json({ 
      error: {
        message: error instanceof Error ? error.message : 'Internal server error',
        type: 'internal_error'
      }
    }, 500)
  }
})

app.get('/v1/models', (c) => {
  return c.json({
    object: 'list',
    data: [
      {
        id: 'claude',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'anthropic'
      }
    ]
  })
})

const port = process.env.PORT || 3000
console.log(`OpenAI-compatible API server running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}
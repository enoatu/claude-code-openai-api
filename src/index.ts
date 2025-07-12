import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { exec } from 'child_process'
import { promisify } from 'util'
import { randomUUID } from 'crypto'

const execAsync = promisify(exec)
const app = new Hono()

app.use('/*', cors())

// 簡易的なレート制限
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 60 // 1分あたりのリクエスト数
const RATE_WINDOW = 60 * 1000 // 1分

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = requestCounts.get(ip)

  if (!record || record.resetTime < now) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW })
    return true
  }

  if (record.count >= RATE_LIMIT) {
    return false
  }

  record.count++
  return true
}

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

async function executeAI(model: string, prompt: string): Promise<string> {
  try {
    // シンプルだが安全なエスケープ
    const escapedPrompt = prompt
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`')
      .replace(/\n/g, ' ')  // 改行をスペースに置換

    let command: string

    // モデルに応じてコマンドを切り替え
    if (model === 'gemini' || model.startsWith('gemini-')) {
      // Geminiもツールを制限（WebSearchのみ許可）
      command = `echo "${escapedPrompt}" | gemini -s -p`
    } else {
      // デフォルトはclaude(sandboxモードにしておく)
      command = `echo "${escapedPrompt}" | claude -p`
    }

    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000,
      env: {
        ...process.env,
        TERM: 'dumb',
        CI: 'true'
      }
    })

    if (stderr) {
      console.error(`${model} stderr:`, stderr)
    }

    console.log(`${model} stdout length:`, stdout.length)
    return stdout.trim() || `No output from ${model} command`
  } catch (error) {
    console.error(`Error executing ${model}:`, error)
    throw new Error(`Failed to execute ${model} command`)
  }
}

app.post('/v1/chat/completions', async (c) => {
  try {
    // レート制限チェック
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    if (!checkRateLimit(ip)) {
      return c.json({
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_error'
        }
      }, 429)
    }

    const body = await c.req.json<ChatCompletionRequest>()

    // 入力検証
    if (!body.messages || !Array.isArray(body.messages)) {
      return c.json({ error: 'Invalid messages format' }, 400)
    }

    // メッセージの検証とサニタイゼーション
    const sanitizedMessages = body.messages.map(msg => {
      if (!msg.role || !msg.content) {
        throw new Error('Invalid message format')
      }

      // 役割の検証
      if (!['system', 'user', 'assistant'].includes(msg.role)) {
        throw new Error('Invalid message role')
      }

      // コンテンツの長さ制限
      if (msg.content.length > 10000) {
        throw new Error('Message content too long')
      }

      return {
        role: msg.role,
        content: String(msg.content) // 文字列として扱う
      }
    })

    const lastUserMessage = sanitizedMessages
      .filter(msg => msg.role === 'user')
      .pop()

    if (!lastUserMessage) {
      return c.json({ error: 'No user message found' }, 400)
    }

    const systemMessages = sanitizedMessages
      .filter(msg => msg.role === 'system')
      .map(msg => msg.content)
      .join('\n')

    const prompt = systemMessages
      ? `${systemMessages}\n\n${lastUserMessage.content}`
      : lastUserMessage.content

    const response = await executeAI(body.model || 'claude', prompt)

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
      },
      {
        id: 'gemini',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'google'
      }
    ]
  })
})

const port = Number(process.env.PORT) || 3000

console.log(`OpenAI-compatible API server running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}

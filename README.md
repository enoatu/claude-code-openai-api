# Claude OpenAI API

`claude`コマンドをOpenAI互換APIとして提供するサーバーです。

## 前提条件

- Node.js 18以上
- `claude`コマンドがシステムにインストールされていること

## セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# ビルド
npm run build

# プロダクション実行
npm start

# テストの実行
npm test
```

## API エンドポイント

### 1. チャット補完 - `/v1/chat/completions`

OpenAI互換のチャット補完エンドポイントです。

```bash
# 基本的な使用例
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude",
    "messages": [
      {"role": "user", "content": "こんにちは"}
    ]
  }'

# システムメッセージ付き
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude",
    "messages": [
      {"role": "system", "content": "あなたは親切なアシスタントです。"},
      {"role": "user", "content": "今日の天気は?"}
    ]
  }'

# 会話履歴付き
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude",
    "messages": [
      {"role": "user", "content": "pythonで1から10までの合計を計算して"},
      {"role": "assistant", "content": "Pythonで1から10までの合計を計算するコードは以下のとおりです：\n\n```python\n# 方法1: sum()関数を使う\ntotal = sum(range(1, 11))\nprint(total)  # 55\n```"},
      {"role": "user", "content": "別の方法も教えて"}
    ]
  }'
```

#### レスポンス例

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "claude",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "こんにちは！何かお手伝いできることはありますか？"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 24,
    "total_tokens": 36
  }
}
```

### 2. モデル一覧 - `/v1/models`

利用可能なモデルの一覧を取得します。

```bash
curl http://localhost:3000/v1/models
```

#### レスポンス例

```json
{
  "object": "list",
  "data": [
    {
      "id": "claude",
      "object": "model",
      "created": 1234567890,
      "owned_by": "anthropic"
    }
  ]
}
```

## OpenAI SDK での使用例

### Python

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="dummy"  # このAPIサーバーは認証不要
)

response = client.chat.completions.create(
    model="claude",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)
```

### JavaScript/TypeScript

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'dummy', // このAPIサーバーは認証不要
});

const completion = await openai.chat.completions.create({
  model: 'claude',
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
});

console.log(completion.choices[0].message.content);
```

## 環境変数

- `PORT`: サーバーのポート番号（デフォルト: 3000）

```bash
PORT=8080 npm run dev
```

## 注意事項

- このサーバーは`claude`コマンドをサブプロセスとして実行します
- 認証機能は実装されていません
- ストリーミングレスポンスは未対応です
- エラーハンドリングは基本的なもののみ実装されています

## トラブルシューティング

### claude コマンドが見つからない場合

```bash
# claudeコマンドがインストールされているか確認
which claude

# PATHに追加されているか確認
echo $PATH
```

### ポートが既に使用されている場合

```bash
# 別のポートで起動
PORT=8080 npm run dev
```

## ライセンス

MIT
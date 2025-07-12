#!/bin/bash
# claudeコマンドの動作を調査するスクリプト

echo "Testing claude command directly..."

# タイムアウト付きで実行
timeout 3 claude -p "test" 2>&1 | tee /tmp/claude-output.txt

echo "Exit code: $?"
echo "Output saved to /tmp/claude-output.txt"

# scriptコマンドで端末出力をキャプチャ
echo "Capturing with script command..."
timeout 3 script -c 'claude -p "test"' /tmp/claude-terminal.txt

echo "Terminal output saved to /tmp/claude-terminal.txt"
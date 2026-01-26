# Fallback Models 備用模型機制

Apertis 提供強大的備用模型（Fallback Models）機制，當主要模型請求失敗時，系統會自動切換到備用模型，確保服務的高可用性和穩定性。

## 功能概述

備用模型機制可以自動處理以下情況：
- 模型服務超時或無回應
- 網路連線問題
- 指定模型暫時不可用
- 服務提供商暫時故障

當主要模型失敗時，系統會按照您指定的優先順序嘗試備用模型，直到成功為止。

## 配置方式

### 請求層級配置（優先權最高）

您可以在每個 API 請求中直接指定備用模型配置：

```json
{
  "model": "gpt-5.2",
  "messages": [
    {"role": "user", "content": "Hello, how are you?"}
  ],
  "fallback_models": ["gpt-5.2", "claude-haiku-4.5"],
  "fallback_timeout": 25000,
  "fallback_enabled": true
}
```

### Token 層級配置

您也可以在 API Token 設定中預先配置備用模型，這樣所有使用該 Token 的請求都會自動套用這些設定。

## 參數說明

### `fallback_models`
- **類型**: 字串陣列
- **說明**: 備用模型清單，按優先順序排列
- **限制**: 最多 5 個備用模型
- **範例**: `["gpt-5.2", "claude-haiku-4.5", "gemini-pro"]`

### `fallback_timeout`
- **類型**: 整數
- **單位**: 毫秒 (ms)
- **範圍**: 5,000 - 300,000 毫秒 (5 秒 - 300 秒)
- **預設值**: 30,000 毫秒 (30 秒)
- **說明**: 切換到下一個備用模型前的等待時間

### `fallback_enabled`
- **類型**: 布林值
- **預設值**: false
- **說明**: 是否啟用備用模型機制

## Fallback 觸發條件

系統會在以下情況自動觸發備用模型：

### 1. 超時錯誤
- 請求超過設定的 `fallback_timeout` 時間
- 上下文截止時間超過 (context deadline exceeded)

### 2. 連線錯誤
- 連線被拒絕 (connection refused)
- 連線重置 (connection reset)
- 網路無法到達 (network unreachable)
- DNS 解析失敗

### 3. 模型錯誤
- 模型不存在 (model not found)
- 無效模型 (invalid model)
- 模型暫時不可用

### 4. HTTP 狀態錯誤
- 非 200 OK 的 HTTP 狀態碼

## 請求範例

### Python 範例

```python
import openai

# 配置 Apertis
client = openai.OpenAI(
    api_key="your-api-key",
    base_url="https://api.apertis.ai/v1"
)

# 使用備用模型的聊天請求
response = client.chat.completions.create(
    model="gpt-4.1",
    messages=[
        {"role": "user", "content": "Hello, how are you?"}
    ],
    # Fallback 配置
    extra_body={
        "fallback_models": ["gpt-5.2", "gpt-4.1-mini"],
        "fallback_timeout": 25000,  # 25 秒超時
        "fallback_enabled": True
    }
)

print(response.choices[0].message.content)

# 檢查是否使用了備用模型
if hasattr(response, 'headers'):
    if response.headers.get('X-Fallback-Used') == 'true':
        print(f"使用了備用模型: {response.headers.get('X-Actual-Model')}")
        print(f"原始模型: {response.headers.get('X-Fallback-From')}")
        print(f"切換原因: {response.headers.get('X-Fallback-Reason')}")
```

### 使用 requests 庫的完整範例

```python
import requests
import json

url = "https://api.apertis.ai/v1/chat/completions"
headers = {
    "Authorization": "Bearer your-api-key",
    "Content-Type": "application/json"
}

payload = {
    "model": "gpt-5.2",
    "messages": [
        {"role": "user", "content": "請幫我寫一個 Python 函數"}
    ],
    "fallback_models": ["gpt-5.2", "claude-haiku-4.5"],
    "fallback_timeout": 20000,
    "fallback_enabled": True
}

try:
    response = requests.post(url, headers=headers, json=payload, timeout=60)
    
    # 檢查備用模型使用情況
    fallback_used = response.headers.get('X-Fallback-Used', 'false')
    if fallback_used == 'true':
        print(f"備用模型已啟用!")
        print(f"原始模型: {response.headers.get('X-Fallback-From')}")
        print(f"實際使用模型: {response.headers.get('X-Actual-Model')}")
        print(f"切換原因: {response.headers.get('X-Fallback-Reason')}")
    
    result = response.json()
    print(result['choices'][0]['message']['content'])
    
except requests.exceptions.RequestException as e:
    print(f"請求失敗: {e}")
```

### cURL 範例

```bash
# 基本 Fallback 請求
curl -X POST "https://api.apertis.ai/v1/chat/completions" \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "model": "gpt-5.2",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "fallback_models": ["gpt-5.2", "claude-haiku-4.5"],
    "fallback_timeout": 25000,
    "fallback_enabled": true
  }' \
  -w "\n狀態碼: %{http_code}\n響應時間: %{time_total}s\n" \
  -v
```

### 檢查響應 Headers 的 cURL 範例

```bash
# 顯示完整 headers 以檢查 fallback 使用情況
curl -X POST "https://api.apertis.ai/tech/chat/completions" \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -D headers.txt \
  -d '{
    "model": "gpt-5.2",
    "messages": [
      {"role": "user", "content": "測試 fallback 機制"}
    ],
    "fallback_models": ["gpt-5.2"],
    "fallback_timeout": 15000,
    "fallback_enabled": true
  }'

# 查看 fallback 相關的 headers
echo "Fallback 使用情況:"
grep -i "x-fallback" headers.txt
```

## Response Headers 說明

當使用備用模型機制時，API 響應會包含以下自訂 headers：

| Header 名稱 | 說明 | 範例值 |
|------------|------|-------|
| `X-Fallback-Used` | 是否使用了備用模型 | `true` / `false` |
| `X-Fallback-From` | 原始請求的模型名稱 | `gpt-4` |
| `X-Actual-Model` | 實際使用的模型名稱 | `gpt-5.2` |
| `X-Fallback-Reason` | 觸發備用模型的原因 | `primary_model_failed` |

## 配置優先級

1. **請求層級** - API 請求中的 `fallback_*` 參數（最高優先權）
2. **Token 層級** - API Token 設定中的備用模型配置
3. **系統預設** - 30 秒超時，不啟用備用模型

## 最佳實踐

### 1. 選擇合適的備用模型
- 選擇回應速度快的模型作為備用
- 考慮成本因素，從昂貴模型 fallback 到便宜模型
- 確保備用模型支援相同的功能特性

### 2. 設定合理的超時時間
- 一般建議: 20-30 秒
- 複雜任務: 60-120 秒
- 即時對話: 10-15 秒

### 3. 備用模型數量
- 建議 1-3 個備用模型
- 過多備用模型會增加總響應時間
- 系統限制最多 5 個備用模型

## 監控和除錯

### 檢查 Fallback 使用情況

```python
# Python 範例：檢查響應 headers
def check_fallback_usage(response):
    headers = response.headers if hasattr(response, 'headers') else {}
    
    fallback_used = headers.get('X-Fallback-Used', 'false')
    if fallback_used == 'true':
        print("備用模型資訊:")
        print(f"  原始模型: {headers.get('X-Fallback-From')}")
        print(f"  實際模型: {headers.get('X-Actual-Model')}")
        print(f"  切換原因: {headers.get('X-Fallback-Reason')}")
    else:
        print("使用原始模型，未觸發備用機制")
```

### 常見問題

**Q: 為什麼備用模型沒有被觸發？**
A: 檢查 `fallback_enabled` 是否設為 `true`，以及是否正確設定了 `fallback_models`。

**Q: 所有備用模型都失敗了怎麼辦？**
A: 系統會返回最後一個備用模型的錯誤，建議檢查模型可用性和網路連線。

**Q: 如何追蹤備用模型的使用頻率？**
A: 可以通過響應 headers 的 `X-Fallback-Used` 來統計備用模型使用情況。

## 計費說明

- 每個模型按其標準費率計費
- 使用備用模型時，按實際使用的模型計費
- 可通過 `X-Actual-Model` header 確認計費模型
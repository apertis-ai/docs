# 用 Apertis 跑 coding agent：改 baseURL 就好

**一句話：** 把 coding agent 的 baseURL 換成 Apertis，就能用你自己鎖定的開源模型路線（Qwen／DeepSeek／GLM），每筆請求都有證據可對帳。

## 前置
- Apertis API key（預付 credits；key 管理：[https://apertis.ai/setting?tab=keys](https://apertis.ai/setting?tab=keys)）
- 你的 client 支援 OpenAI-compatible 自訂 baseURL

## OpenCode
依 opencode.ai/docs/providers 自訂 provider 模式，於 `opencode.json`：
```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "apertis": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Apertis",
      "options": {
        "baseURL": "https://api.apertis.ai/v1",
        "apiKey": "{env:APERTIS_API_KEY}"
      },
      "models": {
        "qwen3.6-plus": {},
        "glm-5.1": {},
        "deepseek-v3.2": {}
      }
    }
  }
}
```
上列為公開目錄 Model ID 範例（per availability）；**以 Models 頁／GET /v1/models 為準**：[https://docs.apertis.ai/models/](https://docs.apertis.ai/models/) 或 `GET https://api.apertis.ai/v1/models`。

## 其他 client（通用 OpenAI-compatible）
- 設 `OPENAI_BASE_URL=https://api.apertis.ai/v1`、`OPENAI_API_KEY=<Apertis key>`，選開源模型 ID。
- Claude Code：請依官方文件 [https://docs.apertis.ai/installation/claude-code](https://docs.apertis.ai/installation/claude-code)（`APERTIS_BASE_URL`；Anthropic-compatible base＝`https://api.apertis.ai`，不含 /v1）。本頁不取代 eng 文件。
- Codex 類工具：僅在工具支援自訂 OpenAI-compatible 端點時適用，用 `/v1` base。
- 本頁主推開源模型路線；**不承諾閉源 Claude 互換**。

## 建議先試的開源模型
DeepSeek、Qwen（coder 系列）、GLM — **依可用性與已核 SKU**；無產能保證。

## FAQ
- **BYOK 是什麼？** 你可帶自有 provider key；或用 Apertis 的合規開源端點。閉源模型只談你自持的官方 key，我方不轉售。
- **大陸終端用戶？** 僅開源模型，依已核 SKU。
- **請求／帳單怎麼看？** 送出請求後到 Activity（頂部列）可看到該筆紀錄與用量（請求證據＝可核對紀錄）。
- **失敗怎麼辦？** 你可在 key 上設有序模型清單（`fallback_models`）＝你鎖的路線；每筆請求留下可核對紀錄，用量與帳單對得上。

## 下一步
看比較：/compare｜文件：[https://docs.apertis.ai](https://docs.apertis.ai)｜模型：[https://docs.apertis.ai/models/](https://docs.apertis.ai/models/)

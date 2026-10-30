# Apertis 更新紀錄與可攜性

## 你的請求，都有可核對紀錄
- 送出請求後，到 **Activity（頂部列）** 就能看到該筆請求紀錄與用量。
- 用量與帳單對得上；需要時可**請求證據**。
- 這是可核對的紀錄，不是保證。

## 可攜：改 baseURL 就接入，也能隨時離開
- OpenAI 相容：`https://api.apertis.ai/v1` ＋ Apertis key。
- 離開＝把 baseURL 改回去。不綁定。
- 可帶自有 provider key（BYOK）；或用 Apertis 的開源模型端點。
- 上游失敗的切換順序由你在 key 上自己設定（有序模型清單）。

## 更新紀錄（每月一篇）
固定格式：**Shipped／Changed／Deprecated／Known issues**
- Shipped：新上架的開源模型（依公開目錄，per availability）
- Changed：計費說明、介面調整
- Deprecated：下架型號與替代建議
- Known issues：已知問題與處理狀態
每項附一張截圖（遮 key）：Activity 一筆請求、帳單畫面、模型清單差異。

## 連結
模型與牌價：[https://docs.apertis.ai/models/](https://docs.apertis.ai/models/)｜文件：[https://docs.apertis.ai](https://docs.apertis.ai)｜比較：[https://apertis.ai/compare](https://apertis.ai/compare)

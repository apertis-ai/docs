# Mobile Display Fixes

## 問題描述

1. **Sidebar 展開時沒有顯示在最上層**：在 mobile 裝置上打開 sidebar 時，看不到 sidebar 內容
2. **Table 寬度被截斷**：在某些頁面顯示表格時，table 寬度會被截斷，無法橫向滾動

## 修復內容

### 1. Sidebar Z-Index 修復

**文件位置**：`src/css/custom.css` (第 473-488 行)

**修復方式**：
- 在 mobile viewport (≤996px) 上設置正確的 z-index 層級
- `.navbar-sidebar`: z-index 1000（主要 sidebar 容器）
- `.navbar-sidebar__backdrop`: z-index 999（背景遮罩）
- `.navbar-sidebar__brand`, `.navbar-sidebar__items`: z-index 1001（內容層）

**效果**：
- Sidebar 現在會正確顯示在所有內容上方
- 背景遮罩正確覆蓋頁面內容
- Sidebar 內容清晰可見

### 2. Table 橫向滾動修復

**文件位置**：`src/css/custom.css` (第 490-527 行)

**修復方式**：
- 為所有 markdown 內的 table 添加橫向滾動功能
- 啟用 touch-friendly 的滾動體驗（iOS smooth scrolling）
- 在 mobile 上防止 table 單元格內容換行
- 添加視覺提示「→ Scroll to see more」

**效果**：
- Table 在 mobile 上可以橫向滾動
- 內容不會被截斷
- 用戶體驗更好，有明確的滾動提示

## 測試方式

### 測試 Sidebar 修復：
1. 在 mobile 裝置或瀏覽器的 mobile 模擬器中打開網站
2. 點擊左上角的 hamburger menu 圖標
3. 確認 sidebar 正確展開並顯示在最上層
4. 確認可以看到所有 sidebar 選項

### 測試 Table 修復：
1. 打開任何包含寬表格的頁面（例如 API 參考頁面）
2. 在 mobile viewport 中查看
3. 確認可以橫向滑動表格
4. 確認表格內容不會被截斷
5. 確認看到「→ Scroll to see more」提示

## 技術細節

### Responsive Breakpoint
- Mobile 裝置定義：viewport width ≤ 996px
- 這與 Docusaurus 的預設 mobile breakpoint 一致

### CSS 特性使用
- `overflow-x: auto`：啟用橫向滾動
- `-webkit-overflow-scrolling: touch`：iOS 平滑滾動
- `white-space: nowrap`：防止內容換行
- `z-index` 層級管理：確保正確的視覺堆疊順序

### 瀏覽器兼容性
- ✅ iOS Safari
- ✅ Android Chrome
- ✅ Mobile Firefox
- ✅ Desktop responsive mode

## 未來改進建議

1. **Table Responsive Pattern**：考慮為超寬表格添加更高級的響應式解決方案（如卡片式顯示）
2. **Scroll Indicator**：可以添加更明顯的視覺滾動指示器（如漸層遮罩）
3. **Touch Gestures**：考慮添加 swipe 手勢來關閉 sidebar

## 相關文件

- `src/css/custom.css`：主要樣式修復
- `src/css/hover-highlight.css`：hover 效果（未修改）
- `docusaurus.config.js`：Docusaurus 配置（未修改）

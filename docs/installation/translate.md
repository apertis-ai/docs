# 沉浸式翻譯

此為 **網頁翻譯擴充程式**。相較以往的 **Google 翻譯** 會直接覆蓋原文，當需要查看原文則必須恢復翻譯，沉浸式翻譯採用 **將譯文插入原文下方**，以進行雙語對照閱讀，當譯文令人困惑時可直接參照原文。此外，沉浸式翻譯 **支援當前熱門的大型語言模型**，如 `GPT-4o`、`Gemini 1.5 Flash`等模型，顯著提升翻譯精準度。

除翻譯網頁，沉浸式翻譯的官方提供: **翻譯整篇PDF**、**即時翻譯YouTube字幕** 以及 **翻譯 EPUB 電子書** 等功能。以下將詳細介紹如何安裝並使用 **Stima API** 提供之模型。

### 取得沉浸式翻譯擴充程式

請先在 Google 或 Edge 擴充商店中搜尋【沉浸式翻譯】。Google 的[安裝鏈接](https://chromewebstore.google.com/detail/%E6%B2%89%E6%B5%B8%E5%BC%8F%E7%BF%BB%E8%AD%AF-%E7%B6%B2%E9%A0%81%E7%BF%BB%E8%AD%AF%E6%93%B4%E5%85%85-pdf%E7%BF%BB%E8%AD%AF-%E5%85%8D%E8%B2%BB/bpoadfkcbjbfhfodiogcnhhhpibjhbnh)在此，按照一般擴充程式的安裝步驟進行即可。

![](https://hackmd.io/_uploads/ry8_lVdoA.png)

### 設定管道來源 - Stima API

安裝完後應會在右上角找到沉浸式翻譯，點開後選擇左下角的【選項】。

![](https://hackmd.io/_uploads/HJ4O-VuoC.png)

請於基本設定處登入帳戶，選擇任一種方式登入即可。雖然不會使用訂閱功能，但仍需登入才能使用擴充程式。

![](https://hackmd.io/_uploads/B1YpWE_oA.png)

在下方的選擇一個服務提供者中選擇【自訂API Key】，並點擊【展開更多選項】

- **APIKEY** : 輸入您的Stima API Key
- **模型** : gpt-3.5-turbo(建議)、gpt-4-turbo、gpt-4o 擇一
- **自訂API位址** : `https://api.apertis.ai`

![](https://hackmd.io/_uploads/SkNYXNdo0.png)

![](https://hackmd.io/_uploads/H1de44uoC.png)

於輸入之後按右上角的【點擊測試服務】，出現驗證成功代表可以使用。

![](https://hackmd.io/_uploads/SkL44VdiC.png)

### 設定模型 - Claude、Gemini

同樣的介面處，但此處於模型處有更動。

- **APIKEY** : 輸入您的Stima API Key
- **模型** : 請選擇【設置更多模型】
- **自訂API位址** : `https://api.apertis.ai`

![](https://hackmd.io/_uploads/B1PfrNOsR.png)

於方框中輸入 `gemini-1.5-flash-latest, gemini-1.5-pro-latest, claude-3-5-sonnet-20240620`，並儲存。

![](https://hackmd.io/_uploads/rJmIr4_iA.png)

後續使用時，原本【模型】選擇的地方將多出三個模型供使用。

![](https://hackmd.io/_uploads/Hyv_IN_iR.png)

### 使用網頁翻譯

到您要翻譯的網頁，按下【Alt + A】或點擊**螢幕右方的浮動圖標**，即可開始使用

![](https://hackmd.io/_uploads/HJQxwNdo0.png)

### 即時字幕翻譯

這邊可以看到支援的影片網站。

![](https://hackmd.io/_uploads/ByT7uNdiC.jpg)

在 Youtube 上找到欲觀看的影片，且有提供字幕，任何語言皆可。即可於右下方找到沉浸式翻譯的【雙語字幕】圖示，點擊選擇翻譯字幕即可使用。

![](https://hackmd.io/_uploads/BJy9MA2qR.png)

![](https://hackmd.io/_uploads/BJlgXQRhqA.png)

### 翻譯 PDF 文件

點擊右上角的圖標，選擇【PDF/epub】，即可進入 PDF 翻譯介面。若當前頁面為 PDF，系統也將自動跳轉到該介面進行翻譯。

![](https://hackmd.io/_uploads/HJGmDN_jC.png)

上傳欲翻譯之 PDF 文件。

![](https://hackmd.io/_uploads/H1AZER39C.png)
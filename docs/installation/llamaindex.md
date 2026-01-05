# LlamaIndex
### 安裝 LlamaIndex
```bash
pip install llama-index
```
### 使用 Apertis

請至 [**Apertis Key**](https://api.apertis.ai/token) 取得您的 API Key

```python
from llama_index.llms.openai import OpenAI

llm = OpenAI(
    model="gpt-4o",
    api_key="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", # 請填入您的 API Key
    api_base="https://api.apertis.ai/v1")
ret=llm.complete("Donald Trump is ")
print(ret)
```
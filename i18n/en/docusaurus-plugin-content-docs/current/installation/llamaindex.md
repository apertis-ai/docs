# LlamaIndex
### Installing LlamaIndex
```bash
pip install llama-index
```
### Using Apertis

Please obtain your API Key from [**Apertis Key**](https://apertis.ai/token)

```python
from llama_index.llms.openai import OpenAI

llm = OpenAI(
    model="gpt-4o",
    api_key="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", # Please replace with your API Key
    api_base="https://api.apertis.ai/v1")
ret=llm.complete("Donald Trump is ")
print(ret)
``` 
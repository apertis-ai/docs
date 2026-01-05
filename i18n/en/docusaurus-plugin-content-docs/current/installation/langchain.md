# LangChain

### Installing LangChain
```bash
pip install langchain
pip install langchain-openai
```

### Apertis Usage Example

Please obtain your API Key from [**Apertis Key**](https://api.apertis.ai/token)

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

CONFIG = {
    "api_key": "APERTIS_API_KEY",
    "base_url": "https://api.apertis.ai/v1",
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "request_timeout": 30,
}

def get_llm(**kwargs):
    config = CONFIG.copy()
    config.update(kwargs)
    return ChatOpenAI(**config)

def ask(message, **kwargs):
    llm = get_llm(**kwargs)
    
    try:
        response = llm.invoke(message)
        return response.content
    except:
        response = ""
        for chunk in llm.stream(message):
            response += chunk.content
        return response

def ask_stream(message, **kwargs):
    llm = get_llm(**kwargs)
    for chunk in llm.stream(message):
        print(chunk.content, end="", flush=True)
    print()

if __name__ == "__main__":
    response = ask("Hi, introduce yourself")
    print(f"Response: {response}\n")
    
    messages = [
        SystemMessage(content="You are Python expert"),
        HumanMessage(content="What is LangChain?")
    ]
    response = ask(messages)
    print(f"Expert Response: {response}\n")
    
    creative_response = ask("Write a poem", temperature=0.9)
    print(f"Response: {creative_response}\n")
    
    print("Streaming: ", end="")
    ask_stream("Explain AI")
    
    # Switch Model
    fast_response = ask("1+1=?", model="grok-4-fast")
    print(f"\nResponse: {fast_response}")

``` 
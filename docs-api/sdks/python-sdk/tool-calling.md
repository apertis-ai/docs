# Tool Calling

Enable AI models to call functions and interact with external systems, enabling the creation of AI agents and automated workflows.

## Prerequisites

```bash
pip install apertis
```

Get your API Key from [**Apertis**](https://apertis.ai/token)

## Basic Tool Calling

```python
import json
from apertis import Apertis

def get_weather(location: str, unit: str = "celsius") -> str:
    """Simulated weather function."""
    return json.dumps({
        "location": location,
        "temperature": 22,
        "unit": unit,
        "conditions": "sunny"
    })

def main():
    client = Apertis()

    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get the current weather in a given location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "The city name, e.g., 'Tokyo'"
                        },
                        "unit": {
                            "type": "string",
                            "enum": ["celsius", "fahrenheit"],
                            "description": "Temperature unit"
                        }
                    },
                    "required": ["location"]
                }
            }
        }
    ]

    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "user", "content": "What's the weather like in Tokyo?"}
        ],
        tools=tools,
        tool_choice="auto"
    )

    message = response.choices[0].message

    if message.tool_calls:
        tool_call = message.tool_calls[0]
        print(f"Function: {tool_call.function.name}")
        print(f"Arguments: {tool_call.function.arguments}")

        # Execute the function
        args = json.loads(tool_call.function.arguments)
        result = get_weather(**args)
        print(f"Result: {result}")

if __name__ == "__main__":
    main()
```

## Complete Tool Calling Loop

```python
import json
from apertis import Apertis

# Define available functions
def get_weather(location: str, unit: str = "celsius") -> str:
    return json.dumps({"location": location, "temperature": 22, "unit": unit})

def search_products(query: str, max_results: int = 5) -> str:
    return json.dumps({"query": query, "results": ["Product A", "Product B", "Product C"]})

AVAILABLE_FUNCTIONS = {
    "get_weather": get_weather,
    "search_products": search_products,
}

def main():
    client = Apertis()

    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get current weather for a location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {"type": "string", "description": "City name"},
                        "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
                    },
                    "required": ["location"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "search_products",
                "description": "Search for products in the catalog",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"},
                        "max_results": {"type": "integer", "description": "Maximum results"}
                    },
                    "required": ["query"]
                }
            }
        }
    ]

    messages = [
        {"role": "user", "content": "What's the weather in Paris and find me some umbrellas?"}
    ]

    # First API call
    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=messages,
        tools=tools,
        tool_choice="auto"
    )

    message = response.choices[0].message
    messages.append(message)

    # Process tool calls
    if message.tool_calls:
        for tool_call in message.tool_calls:
            function_name = tool_call.function.name
            function_args = json.loads(tool_call.function.arguments)

            print(f"Calling: {function_name}({function_args})")

            # Execute the function
            function_response = AVAILABLE_FUNCTIONS[function_name](**function_args)

            # Add function result to messages
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "name": function_name,
                "content": function_response
            })

        # Second API call with function results
        final_response = client.chat.completions.create(
            model="gpt-4.1",
            messages=messages,
            tools=tools
        )

        print("\nAssistant:", final_response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Forcing Tool Use

```python
import json
from apertis import Apertis

def main():
    client = Apertis()

    tools = [
        {
            "type": "function",
            "function": {
                "name": "extract_entities",
                "description": "Extract named entities from text",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "people": {"type": "array", "items": {"type": "string"}},
                        "places": {"type": "array", "items": {"type": "string"}},
                        "organizations": {"type": "array", "items": {"type": "string"}}
                    },
                    "required": ["people", "places", "organizations"]
                }
            }
        }
    ]

    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "user", "content": "John works at Google in San Francisco with Mary."}
        ],
        tools=tools,
        tool_choice={"type": "function", "function": {"name": "extract_entities"}}
    )

    tool_call = response.choices[0].message.tool_calls[0]
    entities = json.loads(tool_call.function.arguments)

    print("Extracted entities:")
    print(f"  People: {entities['people']}")
    print(f"  Places: {entities['places']}")
    print(f"  Organizations: {entities['organizations']}")

if __name__ == "__main__":
    main()
```

## Parallel Tool Calls

```python
import json
from apertis import Apertis

def main():
    client = Apertis()

    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_stock_price",
                "description": "Get stock price for a symbol",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "symbol": {"type": "string", "description": "Stock symbol"}
                    },
                    "required": ["symbol"]
                }
            }
        }
    ]

    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "user", "content": "Get the stock prices for AAPL, GOOGL, and MSFT"}
        ],
        tools=tools,
        parallel_tool_calls=True  # Enable parallel calls
    )

    message = response.choices[0].message

    if message.tool_calls:
        print(f"Model requested {len(message.tool_calls)} parallel tool calls:")
        for tool_call in message.tool_calls:
            args = json.loads(tool_call.function.arguments)
            print(f"  - get_stock_price(symbol='{args['symbol']}')")

if __name__ == "__main__":
    main()
```

## Supported Models

Tool calling is supported by:

| Provider | Models |
|----------|--------|
| OpenAI | `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1` |
| Anthropic | `claude-sonnet-4.5`, `claude-opus-4-5-20251101`, `claude-haiku-4-5-20250501` |
| Google | `gemini-3-pro-preview`, `gemini-2.5-flash` |
| DeepSeek | `deepseek-chat` |

[View all models →](/references/models)

## API Reference

| Parameter | Type | Description |
|-----------|------|-------------|
| `tools` | `list` | List of tool definitions |
| `tool_choice` | `str \| dict` | Tool selection: `"auto"`, `"none"`, `"required"`, or specific function |
| `parallel_tool_calls` | `bool` | Allow multiple simultaneous tool calls |

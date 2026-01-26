# Reasoning & Extended Thinking

Enable chain-of-thought reasoning and extended thinking capabilities for complex problem-solving, analysis, and multi-step tasks.

## Prerequisites

```bash
pip install apertis
```

Get your API Key from [**Apertis**](https://apertis.ai/token)

## Basic Reasoning

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.chat.completions.create(
        model="o1",  # OpenAI reasoning model
        messages=[
            {"role": "user", "content": "Solve this step by step: A train travels from A to B at 60 km/h and returns at 40 km/h. What is the average speed for the round trip?"}
        ]
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Extended Thinking with Claude

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.chat.completions.create(
        model="claude-sonnet-4.5",
        messages=[
            {"role": "user", "content": "Analyze the pros and cons of microservices vs monolithic architecture for a startup."}
        ],
        extra_body={
            "thinking": {
                "type": "enabled",
                "budget_tokens": 10000  # Token budget for thinking
            }
        }
    )

    message = response.choices[0].message

    # Access thinking content if available
    if hasattr(message, 'thinking') and message.thinking:
        print("=== Thinking Process ===")
        print(message.thinking)
        print("\n=== Final Answer ===")

    print(message.content)

if __name__ == "__main__":
    main()
```

## DeepSeek Reasoning

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.chat.completions.create(
        model="deepseek-reasoner",
        messages=[
            {"role": "user", "content": "Prove that the square root of 2 is irrational."}
        ]
    )

    message = response.choices[0].message

    # DeepSeek reasoning models include reasoning content
    if hasattr(message, 'reasoning_content') and message.reasoning_content:
        print("=== Reasoning ===")
        print(message.reasoning_content)
        print("\n=== Answer ===")

    print(message.content)

if __name__ == "__main__":
    main()
```

## Complex Problem Solving

```python
from apertis import Apertis

def main():
    client = Apertis()

    problem = """
A company has 3 warehouses (W1, W2, W3) and 4 retail stores (R1, R2, R3, R4).
The supply at each warehouse is: W1=100, W2=150, W3=200 units.
The demand at each store is: R1=80, R2=120, R3=150, R4=100 units.

Transportation costs per unit:
        R1  R2  R3  R4
W1      8   6   10  9
W2      9   12  13  7
W3      14  9   16  5

Find the optimal transportation plan to minimize total cost.
"""

    response = client.chat.completions.create(
        model="o1",
        messages=[
            {"role": "user", "content": problem}
        ]
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Code Analysis with Reasoning

```python
from apertis import Apertis

def main():
    client = Apertis()

    code = '''
def mystery(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr
'''

    response = client.chat.completions.create(
        model="o4-mini",
        messages=[
            {
                "role": "user",
                "content": f"""Analyze this code:
1. What algorithm is this?
2. What is its time complexity? Explain your reasoning.
3. What is its space complexity?
4. How could it be optimized?

```python
{code}
```"""
            }
        ]
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Mathematical Proofs

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.chat.completions.create(
        model="o1",
        messages=[
            {
                "role": "user",
                "content": "Prove by induction that the sum of the first n positive integers is n(n+1)/2"
            }
        ]
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Logic Puzzles

```python
from apertis import Apertis

def main():
    client = Apertis()

    puzzle = """
Five friends (Alice, Bob, Carol, Dave, Eve) each have a different favorite color
(red, blue, green, yellow, purple) and a different pet (cat, dog, fish, bird, rabbit).

Clues:
1. Alice's favorite color is not red or blue.
2. The person with the cat likes yellow.
3. Bob has a dog.
4. Carol's favorite color is blue.
5. Dave doesn't have the rabbit.
6. Eve's favorite color is red.
7. The person who likes green has a fish.
8. Alice doesn't have the bird.

Who has which pet and favorite color?
"""

    response = client.chat.completions.create(
        model="o1",
        messages=[
            {"role": "user", "content": puzzle}
        ]
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Streaming Reasoning (Where Supported)

```python
from apertis import Apertis

def main():
    client = Apertis()

    stream = client.chat.completions.create(
        model="deepseek-reasoner",
        messages=[
            {"role": "user", "content": "What is 25% of 80? Walk through your thinking."}
        ],
        stream=True
    )

    for chunk in stream:
        if chunk.choices[0].delta.content:
            print(chunk.choices[0].delta.content, end="", flush=True)

    print()

if __name__ == "__main__":
    main()
```

## Supported Models

### OpenAI Reasoning Models

| Model | Description |
|-------|-------------|
| `o1` | Full reasoning capabilities |
| `o4-mini` | Faster, more cost-effective |
| `o3-mini` | Latest generation reasoning |

### DeepSeek Reasoning Models

| Model | Description |
|-------|-------------|
| `deepseek-reasoner` | Chain-of-thought reasoning |

### Claude Extended Thinking

| Model | Description |
|-------|-------------|
| `claude-sonnet-4.5` | Extended thinking via `thinking` parameter |
| `claude-opus-4-5-20251101` | Extended thinking via `thinking` parameter |

[View all models →](/references/models)

## API Reference

### Reasoning Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `str` | Reasoning-capable model (required) |

### Claude Extended Thinking

```python
extra_body={
    "thinking": {
        "type": "enabled",
        "budget_tokens": 10000
    }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `str` | `"enabled"` to enable thinking |
| `budget_tokens` | `int` | Maximum tokens for thinking process |

## Best Practices

1. **Use appropriate models** - Reasoning models are designed for complex problems
2. **Be specific** - Clearer problems yield better reasoning
3. **Request step-by-step** - Ask for explicit reasoning steps when needed
4. **Consider cost** - Reasoning models may use more tokens
5. **Verify outputs** - Review reasoning steps for accuracy

# Async Patterns

Use asynchronous programming for high-performance applications, concurrent requests, and efficient I/O handling.

## Prerequisites

```bash
pip install apertis
```

Get your API Key from [**Apertis**](https://apertis.ai/token)

## Basic Async Client

```python
import asyncio
from apertis import AsyncApertis

async def main():
    client = AsyncApertis()

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "user", "content": "Hello, async world!"}
        ]
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    asyncio.run(main())
```

## Concurrent Requests

```python
import asyncio
from apertis import AsyncApertis

async def ask_question(client: AsyncApertis, question: str) -> str:
    """Send a single question and return the response."""
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "user", "content": question}
        ]
    )
    return response.choices[0].message.content

async def main():
    client = AsyncApertis()

    questions = [
        "What is Python?",
        "What is JavaScript?",
        "What is Rust?",
        "What is Go?",
    ]

    # Run all requests concurrently
    tasks = [ask_question(client, q) for q in questions]
    answers = await asyncio.gather(*tasks)

    for question, answer in zip(questions, answers):
        print(f"Q: {question}")
        print(f"A: {answer[:100]}...\n")

if __name__ == "__main__":
    asyncio.run(main())
```

## Async Streaming

```python
import asyncio
from apertis import AsyncApertis

async def main():
    client = AsyncApertis()

    stream = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "user", "content": "Write a haiku about programming."}
        ],
        stream=True
    )

    async for chunk in stream:
        if chunk.choices[0].delta.content:
            print(chunk.choices[0].delta.content, end="", flush=True)

    print()

if __name__ == "__main__":
    asyncio.run(main())
```

## Semaphore for Rate Limiting

```python
import asyncio
from apertis import AsyncApertis

async def process_item(
    client: AsyncApertis,
    semaphore: asyncio.Semaphore,
    item: str
) -> dict:
    """Process a single item with rate limiting."""
    async with semaphore:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "user", "content": f"Summarize: {item}"}
            ]
        )
        return {
            "item": item,
            "summary": response.choices[0].message.content
        }

async def main():
    client = AsyncApertis()

    items = [f"Topic {i}: Some content to summarize." for i in range(20)]

    # Limit to 5 concurrent requests
    semaphore = asyncio.Semaphore(5)

    tasks = [process_item(client, semaphore, item) for item in items]
    results = await asyncio.gather(*tasks)

    for result in results[:3]:
        print(f"{result['item'][:30]}... -> {result['summary'][:50]}...")

    print(f"\nProcessed {len(results)} items")

if __name__ == "__main__":
    asyncio.run(main())
```

## Async Context Manager

```python
import asyncio
from apertis import AsyncApertis

async def main():
    async with AsyncApertis() as client:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "user", "content": "Hello!"}
            ]
        )
        print(response.choices[0].message.content)

    # Client is automatically closed after the context

if __name__ == "__main__":
    asyncio.run(main())
```

## Async Batch Embeddings

```python
import asyncio
from apertis import AsyncApertis

async def embed_batch(
    client: AsyncApertis,
    texts: list[str],
    batch_size: int = 20
) -> list[list[float]]:
    """Embed texts in batches."""
    all_embeddings = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=batch
        )
        all_embeddings.extend([data.embedding for data in response.data])
        print(f"Processed {min(i + batch_size, len(texts))}/{len(texts)}")

    return all_embeddings

async def main():
    client = AsyncApertis()

    texts = [f"Document number {i} with some content." for i in range(100)]

    embeddings = await embed_batch(client, texts)

    print(f"\nGenerated {len(embeddings)} embeddings")
    print(f"Embedding dimensions: {len(embeddings[0])}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Error Handling in Async

```python
import asyncio
from apertis import AsyncApertis
from apertis import APIError, RateLimitError, APIConnectionError

async def safe_request(client: AsyncApertis, prompt: str) -> str | None:
    """Make a request with error handling."""
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content

    except RateLimitError as e:
        print(f"Rate limited: {e}. Waiting before retry...")
        await asyncio.sleep(60)
        return None

    except APIConnectionError as e:
        print(f"Connection error: {e}")
        return None

    except APIError as e:
        print(f"API error: {e}")
        return None

async def main():
    client = AsyncApertis()

    prompts = ["Hello!", "How are you?", "What's 2+2?"]

    tasks = [safe_request(client, p) for p in prompts]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for prompt, result in zip(prompts, results):
        if isinstance(result, Exception):
            print(f"Error for '{prompt}': {result}")
        elif result:
            print(f"'{prompt}' -> {result[:50]}...")

if __name__ == "__main__":
    asyncio.run(main())
```

## Async Retry with Backoff

```python
import asyncio
import random
from apertis import AsyncApertis
from apertis import APIError, RateLimitError

async def request_with_retry(
    client: AsyncApertis,
    prompt: str,
    max_retries: int = 3,
    base_delay: float = 1.0
) -> str:
    """Make a request with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            return response.choices[0].message.content

        except (RateLimitError, APIError) as e:
            if attempt == max_retries - 1:
                raise

            # Exponential backoff with jitter
            delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
            print(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay:.1f}s...")
            await asyncio.sleep(delay)

    raise RuntimeError("Max retries exceeded")

async def main():
    client = AsyncApertis()

    try:
        result = await request_with_retry(client, "Hello!")
        print(f"Result: {result}")
    except Exception as e:
        print(f"Failed after retries: {e}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Async Producer-Consumer Pattern

```python
import asyncio
from apertis import AsyncApertis

async def producer(queue: asyncio.Queue, items: list[str]):
    """Add items to the queue."""
    for item in items:
        await queue.put(item)
    # Signal completion
    await queue.put(None)

async def consumer(
    client: AsyncApertis,
    queue: asyncio.Queue,
    results: list
):
    """Process items from the queue."""
    while True:
        item = await queue.get()
        if item is None:
            queue.task_done()
            break

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "user", "content": f"Process: {item}"}
            ]
        )
        results.append({
            "input": item,
            "output": response.choices[0].message.content
        })
        queue.task_done()

async def main():
    client = AsyncApertis()
    queue = asyncio.Queue()
    results = []

    items = [f"Item {i}" for i in range(10)]

    # Start producer and multiple consumers
    producer_task = asyncio.create_task(producer(queue, items))
    consumer_tasks = [
        asyncio.create_task(consumer(client, queue, results))
        for _ in range(3)  # 3 concurrent consumers
    ]

    # Wait for producer
    await producer_task

    # Signal consumers to stop
    for _ in consumer_tasks:
        await queue.put(None)

    # Wait for consumers
    await asyncio.gather(*consumer_tasks)

    print(f"Processed {len(results)} items")
    for r in results[:3]:
        print(f"  {r['input']} -> {r['output'][:30]}...")

if __name__ == "__main__":
    asyncio.run(main())
```

## API Reference

### AsyncApertis Client

```python
from apertis import AsyncApertis

# With environment variable
client = AsyncApertis()

# With explicit API key
client = AsyncApertis(api_key="sk-your-api-key")

# As context manager
async with AsyncApertis() as client:
    # Use client
    pass
```

### Available Async Methods

| Endpoint | Method |
|----------|--------|
| Chat Completions | `await client.chat.completions.create()` |
| Embeddings | `await client.embeddings.create()` |
| Messages | `await client.messages.create()` |
| Responses | `await client.responses.create()` |
| Rerank | `await client.rerank.create()` |
| Audio Transcription | `await client.audio.transcriptions.create()` |
| Audio Translation | `await client.audio.translations.create()` |
| Audio Speech | `await client.audio.speech.create()` |

## Best Practices

1. **Use semaphores** - Limit concurrent requests to avoid rate limits
2. **Handle errors gracefully** - Implement retry logic with backoff
3. **Use context managers** - Ensure resources are properly cleaned up
4. **Batch when possible** - Group related operations for efficiency
5. **Consider timeouts** - Set appropriate timeouts for operations
6. **Profile performance** - Measure actual improvements from async

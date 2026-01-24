# Embeddings

Generate vector embeddings for text, enabling semantic search, clustering, and retrieval-augmented generation (RAG) applications.

## Prerequisites

```bash
pip install apertis
```

Get your API Key from [**Apertis**](https://apertis.ai/token)

## Basic Embedding

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.embeddings.create(
        model="text-embedding-3-small",
        input="Machine learning is a subset of artificial intelligence."
    )

    embedding = response.data[0].embedding

    print(f"Embedding dimensions: {len(embedding)}")
    print(f"First 5 values: {embedding[:5]}")

if __name__ == "__main__":
    main()
```

## Batch Embeddings

```python
from apertis import Apertis

def main():
    client = Apertis()

    texts = [
        "Python is a programming language.",
        "JavaScript runs in the browser.",
        "Rust is known for memory safety.",
        "Go is great for concurrent programming."
    ]

    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts
    )

    for i, data in enumerate(response.data):
        print(f"Text {i + 1}: {len(data.embedding)} dimensions")

    print(f"\nTotal tokens used: {response.usage.total_tokens}")

if __name__ == "__main__":
    main()
```

## Reduced Dimensions

```python
from apertis import Apertis

def main():
    client = Apertis()

    # Full dimensions
    full_response = client.embeddings.create(
        model="text-embedding-3-large",
        input="Hello world"
    )

    # Reduced dimensions for efficiency
    reduced_response = client.embeddings.create(
        model="text-embedding-3-large",
        input="Hello world",
        dimensions=1024  # Reduce from 3072 to 1024
    )

    print(f"Full dimensions: {len(full_response.data[0].embedding)}")
    print(f"Reduced dimensions: {len(reduced_response.data[0].embedding)}")

if __name__ == "__main__":
    main()
```

## Semantic Similarity

```python
import numpy as np
from apertis import Apertis

def cosine_similarity(vec1: list, vec2: list) -> float:
    """Calculate cosine similarity between two vectors."""
    a = np.array(vec1)
    b = np.array(vec2)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def main():
    client = Apertis()

    texts = [
        "I love programming in Python",
        "Python is my favorite language",
        "The weather is nice today",
    ]

    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts
    )

    embeddings = [data.embedding for data in response.data]

    print("Similarity scores:")
    print(f"  Text 1 vs Text 2: {cosine_similarity(embeddings[0], embeddings[1]):.4f}")
    print(f"  Text 1 vs Text 3: {cosine_similarity(embeddings[0], embeddings[2]):.4f}")
    print(f"  Text 2 vs Text 3: {cosine_similarity(embeddings[1], embeddings[2]):.4f}")

if __name__ == "__main__":
    main()
```

## Semantic Search

```python
import numpy as np
from apertis import Apertis

def cosine_similarity(vec1: list, vec2: list) -> float:
    a = np.array(vec1)
    b = np.array(vec2)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def main():
    client = Apertis()

    # Document corpus
    documents = [
        "Python is great for data science and machine learning.",
        "JavaScript is the language of the web.",
        "Rust provides memory safety without garbage collection.",
        "Go excels at building concurrent systems.",
        "TypeScript adds static typing to JavaScript.",
    ]

    # Generate embeddings for documents
    doc_response = client.embeddings.create(
        model="text-embedding-3-small",
        input=documents
    )
    doc_embeddings = [data.embedding for data in doc_response.data]

    # Search query
    query = "Which language is best for web development?"

    query_response = client.embeddings.create(
        model="text-embedding-3-small",
        input=query
    )
    query_embedding = query_response.data[0].embedding

    # Find most similar documents
    similarities = [
        (i, cosine_similarity(query_embedding, doc_emb))
        for i, doc_emb in enumerate(doc_embeddings)
    ]
    similarities.sort(key=lambda x: x[1], reverse=True)

    print(f"Query: {query}\n")
    print("Results:")
    for i, (doc_idx, score) in enumerate(similarities[:3], 1):
        print(f"  {i}. [{score:.4f}] {documents[doc_idx]}")

if __name__ == "__main__":
    main()
```

## Async Batch Processing

```python
import asyncio
from apertis import AsyncApertis

async def main():
    client = AsyncApertis()

    # Large batch of texts
    texts = [f"Document number {i} about various topics." for i in range(100)]

    # Process in batches of 20
    batch_size = 20
    all_embeddings = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=batch
        )
        all_embeddings.extend([data.embedding for data in response.data])
        print(f"Processed {min(i + batch_size, len(texts))}/{len(texts)} documents")

    print(f"\nTotal embeddings: {len(all_embeddings)}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Supported Models

| Model | Dimensions | Description |
|-------|------------|-------------|
| `text-embedding-3-small` | 1536 | Fast, cost-effective |
| `text-embedding-3-large` | 3072 | Higher quality, supports dimension reduction |
| `text-embedding-ada-002` | 1536 | Legacy model |

[View all models →](/references/models)

## API Reference

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `str` | Embedding model identifier (required) |
| `input` | `str \| list[str]` | Text(s) to embed (required) |
| `dimensions` | `int` | Output dimensions (for models that support it) |
| `encoding_format` | `str` | Output format: `"float"` or `"base64"` |

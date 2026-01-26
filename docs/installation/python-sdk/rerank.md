# Rerank

Reorder documents by relevance to a query, improving search results and retrieval-augmented generation (RAG) pipelines.

## Prerequisites

```bash
pip install apertis
```

Get your API Key from [**Apertis**](https://apertis.ai/token)

## Basic Reranking

```python
from apertis import Apertis

def main():
    client = Apertis()

    query = "What is machine learning?"

    documents = [
        "Machine learning is a subset of artificial intelligence.",
        "The weather today is sunny and warm.",
        "Deep learning uses neural networks with many layers.",
        "Python is a popular programming language.",
        "ML algorithms learn patterns from data.",
    ]

    response = client.rerank.create(
        model="rerank-v3.5",
        query=query,
        documents=documents
    )

    print(f"Query: {query}\n")
    print("Reranked results:")
    for result in response.results:
        print(f"  [{result.relevance_score:.4f}] {documents[result.index]}")

if __name__ == "__main__":
    main()
```

## Reranking with Document Objects

```python
from apertis import Apertis

def main():
    client = Apertis()

    query = "Python web frameworks"

    documents = [
        {"text": "Django is a high-level Python web framework.", "id": "doc1"},
        {"text": "Flask is a lightweight WSGI web application framework.", "id": "doc2"},
        {"text": "JavaScript runs in the browser.", "id": "doc3"},
        {"text": "FastAPI is a modern Python framework for building APIs.", "id": "doc4"},
        {"text": "React is a JavaScript library for building UIs.", "id": "doc5"},
    ]

    response = client.rerank.create(
        model="rerank-v3.5",
        query=query,
        documents=[doc["text"] for doc in documents]
    )

    print(f"Query: {query}\n")
    print("Top results:")
    for result in response.results[:3]:
        doc = documents[result.index]
        print(f"  [{result.relevance_score:.4f}] [{doc['id']}] {doc['text']}")

if __name__ == "__main__":
    main()
```

## Top-N Results

```python
from apertis import Apertis

def main():
    client = Apertis()

    query = "database optimization techniques"

    documents = [
        "Indexing improves query performance significantly.",
        "Python is great for data analysis.",
        "Query optimization reduces database load.",
        "NoSQL databases are horizontally scalable.",
        "Caching frequently accessed data improves speed.",
        "Machine learning requires large datasets.",
        "Database normalization reduces redundancy.",
        "Cloud computing offers scalability benefits.",
    ]

    response = client.rerank.create(
        model="rerank-v3.5",
        query=query,
        documents=documents,
        top_n=3  # Only return top 3 results
    )

    print(f"Query: {query}\n")
    print("Top 3 results:")
    for result in response.results:
        print(f"  [{result.relevance_score:.4f}] {documents[result.index]}")

if __name__ == "__main__":
    main()
```

## RAG Pipeline Integration

```python
from apertis import Apertis

def main():
    client = Apertis()

    # Simulated vector search results (would come from a vector database)
    vector_search_results = [
        {"text": "Python supports multiple programming paradigms.", "score": 0.85},
        {"text": "Python was created by Guido van Rossum.", "score": 0.82},
        {"text": "Python's syntax emphasizes readability.", "score": 0.80},
        {"text": "Java is a compiled programming language.", "score": 0.75},
        {"text": "Python has a large standard library.", "score": 0.73},
        {"text": "C++ is used for system programming.", "score": 0.70},
    ]

    query = "Who created Python and what makes it special?"

    # Rerank the vector search results
    documents = [doc["text"] for doc in vector_search_results]

    response = client.rerank.create(
        model="rerank-v3.5",
        query=query,
        documents=documents,
        top_n=3
    )

    print("Vector search results (before reranking):")
    for doc in vector_search_results[:3]:
        print(f"  [{doc['score']:.2f}] {doc['text']}")

    print("\nReranked results:")
    for result in response.results:
        print(f"  [{result.relevance_score:.4f}] {documents[result.index]}")

    # Use reranked results for generation
    context = "\n".join([documents[r.index] for r in response.results])

    chat_response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": f"Answer based on this context:\n{context}"},
            {"role": "user", "content": query}
        ]
    )

    print(f"\nGenerated answer:\n{chat_response.choices[0].message.content}")

if __name__ == "__main__":
    main()
```

## Batch Reranking

```python
import asyncio
from apertis import AsyncApertis

async def rerank_query(client: AsyncApertis, query: str, documents: list) -> dict:
    """Rerank documents for a single query."""
    response = await client.rerank.create(
        model="rerank-v3.5",
        query=query,
        documents=documents,
        top_n=3
    )
    return {
        "query": query,
        "results": [(documents[r.index], r.relevance_score) for r in response.results]
    }

async def main():
    client = AsyncApertis()

    documents = [
        "Python is a high-level programming language.",
        "JavaScript is used for web development.",
        "Machine learning uses statistical methods.",
        "SQL is used for database queries.",
        "APIs enable software communication.",
    ]

    queries = [
        "What language is best for beginners?",
        "How to build websites?",
        "What is AI?",
    ]

    # Process queries concurrently
    tasks = [rerank_query(client, q, documents) for q in queries]
    results = await asyncio.gather(*tasks)

    for result in results:
        print(f"\nQuery: {result['query']}")
        for doc, score in result['results']:
            print(f"  [{score:.4f}] {doc}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Relevance Threshold

```python
from apertis import Apertis

def main():
    client = Apertis()

    query = "cloud computing benefits"

    documents = [
        "Cloud computing provides scalability and flexibility.",
        "AWS offers various cloud services.",
        "Python is a programming language.",
        "Cloud storage reduces hardware costs.",
        "The weather is nice today.",
        "Serverless computing is a cloud model.",
    ]

    response = client.rerank.create(
        model="rerank-v3.5",
        query=query,
        documents=documents
    )

    # Filter by relevance threshold
    threshold = 0.5
    relevant_results = [r for r in response.results if r.relevance_score >= threshold]

    print(f"Query: {query}")
    print(f"Threshold: {threshold}\n")
    print(f"Relevant documents ({len(relevant_results)}/{len(documents)}):")

    for result in relevant_results:
        print(f"  [{result.relevance_score:.4f}] {documents[result.index]}")

if __name__ == "__main__":
    main()
```

## Supported Models

| Model | Description |
|-------|-------------|
| `rerank-v3.5` | Latest reranking model |
| `rerank-english-v3.0` | English-optimized |
| `rerank-multilingual-v3.0` | Multilingual support |
| `rerank-english-v2.0` | Legacy English model |

[View all models →](/references/models)

## API Reference

### Request Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `str` | Reranking model (required) |
| `query` | `str` | Search query (required) |
| `documents` | `list[str]` | Documents to rerank (required) |
| `top_n` | `int` | Number of results to return |
| `return_documents` | `bool` | Include document text in response |

### Response Object

| Field | Type | Description |
|-------|------|-------------|
| `results` | `list` | Ranked results |
| `results[].index` | `int` | Original document index |
| `results[].relevance_score` | `float` | Relevance score (0-1) |

## Best Practices

1. **Use after initial retrieval** - Reranking works best on pre-filtered candidates
2. **Limit candidates** - 100-1000 documents is optimal for reranking
3. **Set appropriate top_n** - Only retrieve what you need
4. **Consider threshold filtering** - Filter low-relevance results
5. **Combine with embeddings** - Use embeddings for recall, reranking for precision

# Prompt Cache

## Overview

Stima API includes a powerful Prompt Cache feature that significantly improves system performance, reduces processing time for repeated requests, and lowers API costs. When the same prompt is requested multiple times, the system returns results directly from the cache without calling the upstream AI model again.

## Key Features

### Core Benefits
- **Performance Boost**: Cache hits reduce response time from seconds to milliseconds
- **Cost Savings**: Reduces API calls to upstream AI providers, lowering usage costs
- **Exact Matching**: Supports exact-match cache responses
- **Automatic Management**: Built-in TTL (Time To Live) mechanism automatically cleans expired cache

### Technical Architecture
- **Cache Strategy**: LRU (Least Recently Used) eviction policy
- **Concurrency Safe**: Supports cache operations in high-concurrency environments
- **Fault Tolerance**: Automatically falls back to normal request flow when cache fails

## Cache Strategy

### Cache Key Generation

The system generates unique cache keys using:
- Model name
- Prompt content
- System message
- Temperature parameter
- Other relevant parameters

### Cache Hit Conditions

A cache hit requires:
1. Exact same prompt content
2. Same model and parameter settings
3. Cache item not expired
4. Cache size within limits

### Cache Invalidation

Cache invalidates when:
- Exceeds TTL setting
- Redis storage space insufficient
- Manual cache clearing
- System restart (if not persisted)
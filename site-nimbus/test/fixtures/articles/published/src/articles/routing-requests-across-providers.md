---
title: Routing requests across providers
description: How one Apertis key reaches models from several providers, and what happens when one of them is slow.
date: 2026-09-28
author: Apertis team
category: Engineering
---
This fixture stands in for a real article in tests only; it is never published.

## Why route at all

One key, many providers: the router picks a healthy upstream for each request.

## Failover in practice

When an upstream times out, the request moves to the next one.

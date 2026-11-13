---
title: "We moved CI three times in two months"
description: "Our CI moved from GitHub-hosted runners to a Mac mini, a GCE fleet and per-job microVMs in two months: the walls, the measured costs and what we got wrong."
date: 2026-11-13
author: "Yu-Ting Lee, CTO of Apertis"
category: Engineering
tags: ci, infrastructure, cost
---

Between September and November 2026 our CI ran in four places: GitHub-hosted runners, a self-hosted Mac mini, a fleet of GCE VMs, and now per-job microVMs on InstaBox. The last move took the runner bill from about USD 1,000 a month to a measured pace of about USD 195 to 245, and the slowest lane from 30 to 48 minutes down to about 20.

None of the moves was planned as a migration project. Each one happened because the previous setup hit a wall. This post walks through the walls, the numbers, and the estimates we got wrong.

## The short version

| Stage | When | Why we left it |
|---|---|---|
| GitHub-hosted runners | until 2026-09-11 | The bill grew with every push |
| A self-hosted Mac mini | 09-11 to 10-05 | CI shared the host with our agent sessions, and each starved the other |
| GCE VMs, up to five hosts | 10-05 to 11-09 | About USD 1,000 a month, and still queueing |
| InstaBox, one microVM per job | since 11-09 | Still here |

Apertis is an AI infrastructure company: we run a unified API in front of the major model providers. Most of our changes ship through coding agents that work around the clock, so pull-request volume is high at every hour: about 310 merge-gate runs a day. Every design decision below follows from that one number.

## Stage 0: GitHub-hosted, and a bill that tracked push cadence

Our Linux minutes on GitHub-hosted runners were 10,078 in August (USD 46.69), and then 15,765 in the first eleven days of September, a pace of about USD 240 a month.

The dollars were not the problem. The slope was: CI minutes are a function of how often you push, and we were about to push much more.

## Stage 1: a self-hosted Mac mini

We registered four runner slots on the Mac mini that already hosted our agent sessions. The switch was one repository variable holding the runner labels; deleting it sent every job back to GitHub-hosted. That one-variable switch survived every later move and is the most useful thing we built in this whole story.

It worked for three weeks. Then the 5-minute load average on a 10-core machine sat between 45 and 110, with 24 to 31 GB of swap in use. CI and interactive work were starving each other.

## Stage 2: GCE, and the fleet that kept growing

We chose to rent capacity rather than add hardware. The first VM (an `e2-standard-8`) took the heavy lanes on 2026-10-05, and the Mac's load average fell from p50 18 / p90 44 to p50 8 / p90 20.

One host was not enough. Eight days later it was CPU-bound with 56 heavy jobs queued, so the fleet grew to five machines:

| Host | Type | USD a month, on demand |
|---|---|---|
| heavy 1 | e2-standard-8 | 226.6 |
| heavy 2 | e2-custom, 16 vCPU | 420.4 |
| trusted host (main and gate jobs) | e2-standard-8 | 226.6 |
| deploy host | e2-medium | 28.3 |
| control VM (registration broker) | e2-small | 14.2 |
| 660 GB of disk, addresses | | about 84 |
| **Total** | | **about 1,000** |

A few things from this stage that we would do again:

- **No credential on the runner hosts.** A broker on the control VM held the GitHub App token and wrote a single-use registration for each slot. A job that escaped its container found nothing to steal.
- **A separate host for trusted jobs.** Jobs on the main branch never shared a machine with pull-request code.
- **A USD 3 experiment.** We ran the two slowest lanes on `n2-standard-8` against `e2-standard-8`. The warm medians improved 19% and 31%. Machine family mattered more than we assumed, and finding out cost about three dollars.

And one thing we would not: we built an autoscaler, ran it in shadow mode for weeks, and never switched it on. By the time it was trustworthy, the fleet it scaled was being retired.

An audit of 29,257 workflow runs over two weeks showed where the fleet stood. Heavy jobs waited in the queue for 15.2 minutes at p90 and 31.1 at p95. Half of all merge-gate runs (2,258 of 4,559) were cancelled, mostly because the same pull request pushed again. CI ran around the clock on that fleet, as it had on the Mac mini, but not evenly: on 2026-11-04, for example, the busiest hour had 236 workflow runs and the quietest had 9. We were paying USD 1,000 a month for a fleet that queued in the busy hours and was mostly spare capacity in the quiet ones.

## Stage 3: one microVM per job

InstaBox gives each job a fresh microVM and bills per second of vCPU, memory and disk. At list price a 4 vCPU / 8 GiB machine is USD 0.0362 an hour and an 8 vCPU / 16 GiB one is USD 0.0702. There is no host to keep warm and no queue to size.

### Cutover without downtime

We did not trust a new runner pool with required checks on day one, so the move went in four steps:

1. **A shadow lane.** A second workflow, never a required check, ran copies of our two slowest lanes on the new pool for every pull request.
2. **A parity script.** It paired each shadow result with the required run of the same commit and compared outcome and wall time. On day one, 8 of 8 pairs agreed, and the new pool was faster on every one: 20.1 to 20.7 minutes against 29.8 to 48.1 for the PostgreSQL lane, 10.4 to 10.9 against 21.8 to 29.9 for the other.
3. **Flip the variable, heaviest lanes first.** Heavy lanes moved at 11:06 UTC, light and default lanes at 15:04. The old hosts were stopped a few minutes later and kept for seven days as the rollback.
4. **Delete after the rollback window.**

One thing bit us. GitHub reads a variable used in `runs-on` when the run is created, not when the job starts. Three runs created just before the flip still asked for the old labels after the old hosts were gone, and sat for 75 minutes until we cancelled and reran them. If you switch runner pools with a variable, drain or rerun whatever was created before the edit.

### What stayed behind

Jobs that hold a secret beyond the job token (deploys, a few monitors) stayed on GitHub-hosted runners. A test enforces it: a job that reads a deploy secret may not read the pool variable. Shared pools run pull-request code, and we do not want the two in the same place.

## What it costs now

No invoice has arrived yet, so this is measured minutes at list price, not a bill. Over 70 hours of all-InstaBox routing we read every merge-gate run and a 15% sample of everything else:

| | Minutes in 70 h | USD in 70 h | 30-day pace, USD |
|---|---|---|---|
| 8 vCPU machines | 13,526 | 15.83 | 163 |
| 2 vCPU machines | 3,574 | 1.14 | 12 |
| Plan | | | 20 |
| **Total** | | | **about 195** |

If every job is billed an extra minute for boot and teardown, the pace is about USD 240; at the busiest day's rate, about 245. Against roughly USD 1,000 for the GCE fleet, that is a saving of about USD 755 to 805 a month. The same demand on GitHub's 4 vCPU hosted runners, at USD 0.016 a minute, would be an estimated USD 2,800.

## Three estimates we got wrong

**Demand, twice.** Before the pilot we guessed 150,000 to 200,000 job-minutes a month. A first sample during the cutover said 455,000, because it mapped minutes from the slow, contended GCE hosts one for one. A 70-hour sample on InstaBox, scaled to a month, says about 176,000. The same lanes simply take fewer minutes on machines that are not fighting each other. Estimate from minutes measured on the target, not on the thing you are leaving.

**Machine size.** We planned to start every lane on the smaller machine and move up on evidence. At the cutover the heavy lanes went to the 8 vCPU size anyway. When we finally ran the same commit three times on each size, the 4 vCPU machine was not slower on either lane (24.5 against 25.1 minutes, 11.0 against 12.0), at half the price. On these two lanes the wall time is set by the database, not by cores. Our first attempt to move every heavy lane to the smaller size lasted 26 minutes: two of our own tests asserted a scheduling weight that only holds on a machine with eight or more cores, so one job failed on every pull request until we switched back. The tests are fixed, and the trial is being repeated.

**Where the hosted minutes went.** With the test lanes gone, we still exhausted the month's GitHub-hosted allowance. One small workflow that mirrors issue state to a project board was 73% of all remaining hosted minutes: short jobs, triggered by every issue event, each rounded up to a whole minute. It now runs as a loop on a host we already operate.

## Smaller lessons

- **A fixed fleet is priced for its busiest hour.** Our CI runs in every hour of the day, but the busiest hour carries more than ten times the runs of the quietest. Per-job billing follows that curve; a fleet cannot.
- **Retire the monitors with the hosts.** When the control VM stopped, a staleness check that lived in its heartbeat stopped with it, and nothing else was watching that signal. We found it the same day only because we went looking.
- **Killed test runs leave things behind.** Four test copies of the registration broker had been looping on the Mac for more than a week, orphaned when their test process was killed.
- **Keep the old hosts stopped, not deleted, for a week.** Stopped VMs cost only their disks, and the rollback is one command.

## Still open

- The first invoice. Three things are unknown until it arrives: whether CI jobs are billed at the machine rate, how much boot time is billed per job, and egress.
- We now depend on one runner vendor, with GitHub-hosted runners as the manual fallback through the same variable.
- The result of the repeated smaller-machine trial.

We will update this post when those numbers are in.

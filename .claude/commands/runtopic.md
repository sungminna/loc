---
description: Manually trigger one autonomous run for a topic. Usage from dashboard preferred; this slash command is for sandbox/CLI debugging.
---

The dashboard's **Topics → 지금 실행** button is the recommended way to trigger an ad-hoc run — it inserts a `runs` row and enqueues the message for the Worker, which then spawns the sandbox.

This slash command is only useful **inside an already-running sandbox** for re-running orchestration on an existing run id without going through the Queue.

Usage: `/runtopic <runId> <topicId> <userId>`

If `$ARGUMENTS` is empty, abort and tell the user to use the dashboard.

Otherwise:

1. Parse `$ARGUMENTS` into runId / topicId / userId.
2. Set env vars `LOC_RUN_ID`, `LOC_TOPIC_ID`, `LOC_USER_ID` (if not already set by the parent process).
3. Invoke the **orchestrate-run** skill. It will read these env vars and proceed.

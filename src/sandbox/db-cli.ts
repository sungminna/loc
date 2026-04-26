// Tiny CLI that wraps the internal API for use from inside Skill markdown.
// Usage:
//   bun src/sandbox/db-cli.ts set-status <runId> <status> [--error "..."]
//   bun src/sandbox/db-cli.ts set-brief  <runId> <briefJsonPath>
//   bun src/sandbox/db-cli.ts get-topic  <topicId>
//   bun src/sandbox/db-cli.ts get-run    <runId>
//   bun src/sandbox/db-cli.ts get-skill-prompts
//   bun src/sandbox/db-cli.ts get-topic-draft
//   bun src/sandbox/db-cli.ts consume-topic-draft

import { readFileSync } from "node:fs";
import { api } from "./lib/api";

const [, , cmd, ...rest] = process.argv;

async function main(): Promise<void> {
  if (cmd === "set-status") {
    const [runId, status] = rest;
    if (!runId || !status) throw new Error("usage: set-status <runId> <status>");
    const errorIdx = rest.indexOf("--error");
    const error = errorIdx >= 0 ? rest[errorIdx + 1] : undefined;
    await api.setRunStatus(runId, status, error);
    console.log("ok");
    return;
  }
  if (cmd === "set-brief") {
    const [runId, path] = rest;
    if (!runId || !path) throw new Error("usage: set-brief <runId> <briefJsonPath>");
    const brief = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    await api.setBrief(runId, brief);
    console.log("ok");
    return;
  }
  if (cmd === "get-topic") {
    const [id] = rest;
    if (!id) throw new Error("usage: get-topic <topicId>");
    const r = await api.getTopic(id);
    console.log(JSON.stringify(r.topic));
    return;
  }
  if (cmd === "get-run") {
    const [id] = rest;
    if (!id) throw new Error("usage: get-run <runId>");
    const r = await api.getRun(id);
    console.log(JSON.stringify(r.run));
    return;
  }
  if (cmd === "get-skill-prompts") {
    const r = await api.getSkillPrompts();
    console.log(JSON.stringify(r.overrides));
    return;
  }
  if (cmd === "get-topic-draft") {
    const r = await api.getTopicDraft();
    console.log(JSON.stringify(r));
    return;
  }
  if (cmd === "consume-topic-draft") {
    await api.consumeTopicDraft();
    console.log("ok");
    return;
  }
  console.error("unknown command");
  process.exit(2);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});

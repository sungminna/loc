import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import type { Sandbox as SandboxClass } from "@cloudflare/sandbox";

export interface Env {
  // Bindings
  DB: D1Database;
  MEDIA: R2Bucket;
  TOKENS: KVNamespace;
  CACHE: KVNamespace;
  RUNS_QUEUE: Queue<RunMessage>;
  TOPIC_RUNNER: DurableObjectNamespace;
  Sandbox: DurableObjectNamespace<SandboxClass>;
  ANALYTICS: AnalyticsEngineDataset;
  ASSETS: Fetcher;

  // Vars
  PUBLIC_WORKER_URL: string;
  R2_PUBLIC_BASE: string;
  GEMINI_MODEL: string;
  AI_GATEWAY_BASE: string;

  // Secrets
  CLAUDE_CODE_OAUTH_TOKEN: string;
  LOC_MASTER_KEY: string;
  GEMINI_API_KEY: string;
  INTERNAL_API_KEY: string;
  META_APP_ID: string;
  META_APP_SECRET: string;
  THREADS_APP_ID: string;
  THREADS_APP_SECRET: string;
  GITHUB_REPO_URL: string;
  DEV_USER_EMAIL?: string;
}

export interface RunMessage {
  runId: string;
  topicId: string;
  userId: string;
}

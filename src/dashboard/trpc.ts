import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../worker/api/trpc";

export const trpc = createTRPCReact<AppRouter>();

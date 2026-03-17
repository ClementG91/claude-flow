import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@claude-flow/server';

export const trpc = createTRPCReact<AppRouter>();

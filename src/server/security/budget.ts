import "server-only";
import { securityEvent } from "./events";

export class ProcessingBusyError extends Error {
  constructor() { super("Processing is busy. Try again shortly."); }
}
const active = new Map<string, number>();
/** Per-process concurrency cap. Distributed daily quotas are enforced separately. */
export async function withCapacity<T>(name: string, limit: number, work: () => Promise<T>): Promise<T> {
  const count = active.get(name) ?? 0;
  if (count >= limit) { securityEvent("processing_busy"); throw new ProcessingBusyError(); }
  active.set(name, count + 1);
  try { return await work(); }
  finally {
    const remaining = (active.get(name) ?? 1) - 1;
    if (remaining) active.set(name, remaining); else active.delete(name);
  }
}

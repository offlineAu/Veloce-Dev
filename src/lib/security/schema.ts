import { z } from "zod";

// Zod's optional JIT uses Function(), including a feature probe. Disable it
// before constructing any schemas so production strict CSP needs no unsafe-eval.
z.config({ jitless: true });
export { z };

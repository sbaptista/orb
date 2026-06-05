# Eval Suite Socket Exhaustion / Connection Drops

During full runs of the Orb evaluation suite (`NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/orb-eval.ts`), the runner occasionally encounters `fetch failed` errors on the final few cases. This document details why this happens and proposes solutions for Claude (or a future developer) to address.

## Symptom

When running the full suite (5 deterministic Tier 1 runs + 21 statistical Tier 2 runs = 26 total runs):
- The first 15–20 runs complete successfully.
- The tail-end runs (e.g., `whats-new`, `mutation-approval`, `strategic-guidance-scoping`) fail immediately with:
  ```
  ❌ [T2] whats-new (0/3) 1275ms
       → Error: fetch failed
  ```
- Running the failed cases individually immediately afterward (e.g., `npx tsx scripts/orb-eval.ts --id whats-new`) passes successfully (3/3).

## Technical Cause

1. **Sequential Latency Accumulation**: The test runner issues requests sequentially. With 26 runs, each taking between 3–7 seconds (waiting for Claude 3.5 Sonnet to generate responses), the entire suite takes about **2.5 minutes** of sustained local server activity.
2. **Next.js Dev Server Limitations**: The Next.js dev server running on port `3001` in development mode is single-threaded and handles incoming requests synchronously.
3. **Socket Exhaustion**: Sustained HTTPS requests over a self-signed localhost certificate eventually saturate the local socket pool or hit HTTP keep-alive timeouts, leading to connection resets and client-side `fetch failed` errors.

## Proposed Solutions (for Claude/Future Developer)

To resolve this issue and make the evaluation suite robust against transient network drops and local socket exhaustion, implement the following changes in `scripts/orb-eval.ts`:

### 1. Implement Retry Logic for Transient Network Failures
Currently, `scripts/orb-eval.ts` catches rate-limit and credit-balance warnings but treats network errors (`fetch failed`) as hard failures. We should catch `fetch failed` / `ECONNRESET` / `ETIMEDOUT` and retry the request up to 3 times with exponential backoff:

```typescript
async function callOrbWithRetry(testCase: EvalCase, retries = 3, delay = 1000): Promise<EvalResponse> {
  for (let i = 0; i < retries; i++) {
    try {
      return await callOrb(testCase);
    } catch (err: any) {
      const isNetworkError = err.message.includes('fetch failed') || err.message.includes('CONN');
      if (isNetworkError && i < retries - 1) {
        console.warn(`\n  ⚠️  Connection failed on ${testCase.id} — retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
  throw new Error('Retries exhausted');
}
```

### 2. Introduce a Cool-off Delay Between Runs
Add a small delay (e.g., 200–500ms) between runs to let the local TCP socket pool clear out and allow the dev server to keep up:

```typescript
// Inside the main loops
for (let i = 0; i < runs; i++) {
  // ... run test case ...
  await new Promise(r => setTimeout(r, 300)); // cool-off
}
```

### 3. Configure Keep-Alive or Agent Options
Customize the `fetch` call in the runner to use an agent that disables keep-alive or recycles connections properly if Node's native fetch under-performs under sustained load.

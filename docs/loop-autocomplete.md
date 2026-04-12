# `getArgumentCompletions` for `/loop`

## Context

`ExtensionCommandOptions` supports an optional `getArgumentCompletions` callback:

```ts
getArgumentCompletions?: (argumentPrefix: string) => AutocompleteItem[] | null | Promise<AutocompleteItem[] | null>;
```

`AutocompleteItem`:

```ts
interface AutocompleteItem {
    value: string;   // Text inserted on selection
    label: string;   // Text shown in the dropdown
    description?: string;
}
```

`argumentPrefix` is everything after `/loop ` up to the cursor. E.g.:

| User typed | `argumentPrefix` |
|---|---|
| `/loop ` | `""` |
| `/loop 5m ` | `"5m "` |
| `/loop cron */5 ` | `"cron */5 "` |
| `/loop check every ` | `"check every "` |

Returning `null` or `[]` suppresses autocomplete for that context.

---

## Four Positions

`parseLoopScheduleArgs` decides how to parse based on four positions. Completions mirror those positions.

### Position 1 — Start of input (`argumentPrefix === ""` or only whitespace)

The user hasn't committed to a syntax yet.

```ts
function loopCompletions(prefix: string): AutocompleteItem[] | null {
    const trimmed = prefix.trimEnd();

    if (trimmed === "") {
        return [
            { value: "cron ",   label: "cron <expr>",   description: "Cron-based recurring schedule (6-field)" },
            { value: "5m ",     label: "5m",             description: "Every 5 minutes" },
            { value: "10m ",    label: "10m",            description: "Every 10 minutes" },
            { value: "15m ",    label: "15m",            description: "Every 15 minutes" },
            { value: "30m ",    label: "30m",            description: "Every 30 minutes" },
            { value: "1h ",     label: "1h",             description: "Every hour" },
            { value: "2h ",     label: "2h",             description: "Every 2 hours" },
            { value: "6h ",     label: "6h",             description: "Every 6 hours" },
            { value: "1d ",     label: "1d",             description: "Every day" },
        ];
    }

    // ... more positions
}
```

> **Note:** Do not include `every ` here. The `every <duration> <prompt>` syntax needs a prompt before it, so suggesting it at the start is confusing.

---

### Position 2 — After `cron ` (e.g., `cron ` or `cron */5 `)

User is typing a cron expression. Provide common 5-field cron expressions. `normalizeCronExpression` will prepend `0 ` if needed, so showing 5-field is fine.

```ts
    if (trimmed.toLowerCase().startsWith("cron ")) {
        const rest = trimmed.slice(5);
        // Only show completions if user hasn't started typing the expression yet,
        // or always show and let them pick/override
        return [
            { value: "*/5 * * * * ",          label: "*/5 * * * *",  description: "Every 5 minutes" },
            { value: "*/15 * * * * ",         label: "*/15 * * * *", description: "Every 15 minutes" },
            { value: "*/30 * * * * ",         label: "*/30 * * * *", description: "Every 30 minutes" },
            { value: "0 * * * * ",            label: "0 * * * *",    description: "Every hour (at :00)" },
            { value: "0 */2 * * * ",          label: "0 */2 * * *",  description: "Every 2 hours" },
            { value: "0 9 * * * ",            label: "0 9 * * *",    description: "Every day at 9:00 AM" },
            { value: "0 9 * * 1-5 ",          label: "0 9 * * 1-5",  description: "Weekdays at 9:00 AM" },
        ];
    }
```

Trailing space after each value: user picks a cron expr, space inserted, cursor is positioned for the prompt.

> **Open question:** Should completions be shown when the user has already started typing a partial cron expression (e.g., `cron */`)? Probably yes — the completions act as suggestions and they'll either override or blend naturally.

---

### Position 3 — After a duration prefix (e.g., `5m `, `2h `)

`extractLeadingDuration` already consumed the duration. The user needs to type the free-form prompt. Returning `[]` or `null` here is correct — no suggestions, no interference.

```ts
    if (parseDuration(trimmed) !== undefined) {
        return []; // or null
    }
```

> **Note:** `parseDuration` trims internally, so `"5m "` → `5m` → `300000`. This correctly identifies the position.

---

### Position 4 — After `every ` (e.g., `check build every `)

The user wrote a prompt and appended `every `. They need duration suggestions. No trailing space on values — `every ` already provides the spacing.

```ts
    if (trimmed.toLowerCase().endsWith(" every ")) {
        return [
            { value: "5m",   label: "5m",  description: "Every 5 minutes" },
            { value: "10m",  label: "10m", description: "Every 10 minutes" },
            { value: "15m",  label: "15m", description: "Every 15 minutes" },
            { value: "30m",  label: "30m", description: "Every 30 minutes" },
            { value: "1h",   label: "1h",  description: "Every hour" },
            { value: "2h",   label: "2h",  description: "Every 2 hours" },
            { value: "6h",   label: "6h",  description: "Every 6 hours" },
            { value: "1d",   label: "1d",  description: "Every day" },
        ];
    }
```

---

## Edge Cases

- **`/loop cron` without a trailing space** — user typed `/loop cron` and cursor is right after `cron`. `trimmed.toLowerCase().startsWith("cron ")` is `false`. Falls through to... `parseDuration("cron")` → `undefined`. `endsWith(" every ")` → false. No completions shown. That's fine; the user just hasn't typed the expression yet. They can keep typing.
- **Partial duration at start** (e.g., `/loop 5`) — `parseDuration("5")` → `undefined`. No special completion. This is fine; the user is mid-token.
- **Cursor mid-prompt** (e.g., `/loop 5m check bui|ld`) — `trimmed` = `"5m check bui"` — doesn't match any position trigger. No completions. Correct.
- **`/loop ` with cursor at end** — `trimmed === ""`. Shows position 1 completions. Good.

---

---

## Implementation Plan

### Step 1: Add `loopArgumentCompletions` to `src/scheduling.ts`

Add the new export at the end of `scheduling.ts`:

```ts
import type { AutocompleteItem } from "@mariozechner/pi-coding-agent";

export function loopArgumentCompletions(argumentPrefix: string): AutocompleteItem[] | null {
    const trimmed = argumentPrefix.trimEnd();

    // Position 1 — Start of input
    if (trimmed === "") {
        return [
            { value: "cron ", label: "cron <expr>", description: "Cron-based recurring schedule (6-field)" },
            { value: "5m ",   label: "5m",            description: "Every 5 minutes" },
            { value: "10m ",  label: "10m",           description: "Every 10 minutes" },
            { value: "15m ",  label: "15m",           description: "Every 15 minutes" },
            { value: "30m ",  label: "30m",           description: "Every 30 minutes" },
            { value: "1h ",   label: "1h",            description: "Every hour" },
            { value: "2h ",   label: "2h",            description: "Every 2 hours" },
            { value: "6h ",   label: "6h",            description: "Every 6 hours" },
            { value: "1d ",   label: "1d",            description: "Every day" },
        ];
    }

    // Position 2 — After `cron `
    if (trimmed.toLowerCase().startsWith("cron ")) {
        return [
            { value: "*/5 * * * * ",  label: "*/5 * * * *",  description: "Every 5 minutes" },
            { value: "*/15 * * * * ", label: "*/15 * * * *", description: "Every 15 minutes" },
            { value: "*/30 * * * * ", label: "*/30 * * * *", description: "Every 30 minutes" },
            { value: "0 * * * * ",    label: "0 * * * *",    description: "Every hour (at :00)" },
            { value: "0 */2 * * * ",  label: "0 */2 * * *",  description: "Every 2 hours" },
            { value: "0 9 * * * ",   label: "0 9 * * *",    description: "Every day at 9:00 AM" },
            { value: "0 9 * * 1-5 ",  label: "0 9 * * 1-5",  description: "Weekdays at 9:00 AM" },
        ];
    }

    // Position 3 — After a duration prefix (e.g., `5m `, `2h `)
    if (parseDuration(trimmed) !== undefined) {
        return []; // No completions for free-form prompt
    }

    // Position 4 — After `every ` (trailing)
    if (trimmed.toLowerCase().endsWith(" every ")) {
        return [
            { value: "5m",  label: "5m",  description: "Every 5 minutes" },
            { value: "10m", label: "10m", description: "Every 10 minutes" },
            { value: "15m", label: "15m", description: "Every 15 minutes" },
            { value: "30m", label: "30m", description: "Every 30 minutes" },
            { value: "1h",  label: "1h",  description: "Every hour" },
            { value: "2h",  label: "2h",  description: "Every 2 hours" },
            { value: "6h",  label: "6h",  description: "Every 6 hours" },
            { value: "1d",  label: "1d",  description: "Every day" },
        ];
    }

    return null;
}
```

**Import added:** `AutocompleteItem` from `@mariozechner/pi-coding-agent`

---

### Step 2: Wire `loopArgumentCompletions` into `src/commands.ts`

Update the `loop` command registration:

```ts
import { ..., loopArgumentCompletions } from "./scheduling";

pi.registerCommand("loop", {
    description: "...",
    getArgumentCompletions: loopArgumentCompletions,  // ← ADD THIS LINE
    handler: async (args, ctx) => {
        // ... existing handler
    },
});
```

---

### Step 3: Add tests to `tests/loop-parse.test.ts`

See [Test Plan](#test-plan) below.

---

### Step 4: Verify TypeScript compilation

```bash
npx tsc --noEmit
```

---

### Step 5: Run tests

```bash
npx tsx --test tests/loop-parse.test.ts
```

---

## Test Plan

Add a new test suite to `tests/loop-parse.test.ts` for `loopArgumentCompletions`.

### Test Suite: `loopArgumentCompletions`

```ts
import { loopArgumentCompletions } from "../src/scheduling.ts";

// --- Position 1 Tests ---

test("loopArgumentCompletions returns duration/cron options at empty prefix", () => {
    const result = loopArgumentCompletions("");
    assert.ok(result);
    assert.ok(result!.length > 0);
    assert.ok(result!.some((c) => c.value === "5m "));
    assert.ok(result!.some((c) => c.value === "cron "));
});

test("loopArgumentCompletions returns duration/cron options at whitespace prefix", () => {
    const result = loopArgumentCompletions("   ");
    assert.ok(result);
    assert.ok(result!.length > 0);
});

test("loopArgumentCompletions does NOT include 'every ' at position 1", () => {
    const result = loopArgumentCompletions("");
    assert.ok(result);
    assert.ok(!result!.some((c) => c.value === "every "));
});

// --- Position 2 Tests ---

test("loopArgumentCompletions returns cron suggestions after 'cron '", () => {
    const result = loopArgumentCompletions("cron ");
    assert.ok(result);
    assert.ok(result!.length > 0);
    assert.ok(result!.some((c) => c.value.startsWith("*/5")));
    assert.ok(result!.some((c) => c.value.startsWith("0 *")));
});

test("loopArgumentCompletions returns cron suggestions when partial cron typed", () => {
    const result = loopArgumentCompletions("cron */");
    assert.ok(result);
    assert.ok(result!.length > 0);
});

test("loopArgumentCompletions is case-insensitive for 'cron '", () => {
    const result = loopArgumentCompletions("CRON ");
    assert.ok(result);
    assert.ok(result!.length > 0);
});

test("loopArgumentCompletions returns cron suggestions without trailing space after 'cron '", () => {
    // User typed `/loop cron` with cursor right after `cron`
    const result = loopArgumentCompletions("cron");
    assert.equal(result, null); // No completions until space is typed
});

// --- Position 3 Tests ---

test("loopArgumentCompletions returns empty array after duration prefix", () => {
    const result = loopArgumentCompletions("5m ");
    assert.deepEqual(result, []);
});

test("loopArgumentCompletions returns empty array after hours prefix", () => {
    const result = loopArgumentCompletions("2h ");
    assert.deepEqual(result, []);
});

test("loopArgumentCompletions returns empty array after days prefix", () => {
    const result = loopArgumentCompletions("1d ");
    assert.deepEqual(result, []);
});

test("loopArgumentCompletions returns empty array with prompt after duration", () => {
    const result = loopArgumentCompletions("5m check build ");
    assert.deepEqual(result, []);
});

// --- Position 4 Tests ---

test("loopArgumentCompletions returns duration options after 'every '", () => {
    const result = loopArgumentCompletions("check build every ");
    assert.ok(result);
    assert.ok(result!.length > 0);
    assert.ok(result!.some((c) => c.value === "5m"));
    assert.ok(result!.some((c) => c.value === "1h"));
});

test("loopArgumentCompletions is case-insensitive for 'every '", () => {
    const result = loopArgumentCompletions("check build EVERY ");
    assert.ok(result);
    assert.ok(result!.length > 0);
});

test("loopArgumentCompletions has NO trailing space on values after 'every '", () => {
    const result = loopArgumentCompletions("check build every ");
    assert.ok(result);
    assert.ok(!result!.some((c) => c.value.endsWith(" ")));
});

// --- Edge Case Tests ---

test("loopArgumentCompletions returns null for partial duration (e.g., '5')", () => {
    const result = loopArgumentCompletions("5");
    assert.equal(result, null);
});

test("loopArgumentCompletions returns null for mid-prompt cursor", () => {
    const result = loopArgumentCompletions("5m check bui");
    assert.equal(result, null);
});

test("loopArgumentCompletions returns null for arbitrary text", () => {
    const result = loopArgumentCompletions("random text");
    assert.equal(result, null);
});

// --- Completion Value/Label Sanity Tests ---

test("loopArgumentCompletions values have trailing space at position 1", () => {
    const result = loopArgumentCompletions("");
    assert.ok(result);
    for (const item of result!) {
        assert.ok(
            item.value.endsWith(" ") || item.value.endsWith("*"),
            `Expected value "${item.value}" to end with space or *`,
        );
    }
});

test("loopArgumentCompletions items have label property", () => {
    const result = loopArgumentCompletions("");
    assert.ok(result);
    for (const item of result!) {
        assert.ok(typeof item.label === "string" && item.label.length > 0);
    }
});

test("loopArgumentCompletions items have description property", () => {
    const result = loopArgumentCompletions("");
    assert.ok(result);
    for (const item of result!) {
        assert.ok(typeof item.description === "string" && item.description.length > 0);
    }
});
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/scheduling.ts` | Add `loopArgumentCompletions` export |
| `src/commands.ts` | Add `getArgumentCompletions: loopArgumentCompletions` to `loop` command |
| `tests/loop-parse.test.ts` | Add test suite for `loopArgumentCompletions` |

---

## Phased Rollout

1. **Phase 1 (this PR):** Implement `/loop` autocomplete
2. **Phase 2:** Implement `/remind` autocomplete
3. **Phase 3:** Implement `/schedule` autocomplete

Each phase follows the same pattern: add `XxxArgumentCompletions` to `scheduling.ts`, wire it into the command in `commands.ts`, and add tests.

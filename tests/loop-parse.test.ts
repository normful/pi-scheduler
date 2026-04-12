import test from "node:test";
import assert from "node:assert/strict";
import { loopArgumentCompletions, parseLoopScheduleArgs } from "../index.ts";

// --- loopArgumentCompletions Tests ---

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

test("loopArgumentCompletions returns null without trailing space after 'cron '", () => {
	// User typed `/loop cron` with cursor right after `cron`
	const result = loopArgumentCompletions("cron");
	assert.equal(result, null);
});

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

test("loopArgumentCompletions returns null for partial duration (e.g., '5')", () => {
	const result = loopArgumentCompletions("5");
	assert.equal(result, null);
});

test("loopArgumentCompletions returns null or [] for mid-prompt cursor", () => {
	// Position 3: after duration prefix, user is typing prompt.
	// Both null and [] are valid per spec — no completions shown.
	const result = loopArgumentCompletions("5m check bui");
	assert.ok(result === null || result.length === 0, "Expected null or empty array");
});

test("loopArgumentCompletions returns null for arbitrary text", () => {
	const result = loopArgumentCompletions("random text");
	assert.equal(result, null);
});

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

// --- parseLoopScheduleArgs Tests ---

test("parseLoopScheduleArgs parses explicit cron with 5-field expression", () => {
	const parsed = parseLoopScheduleArgs("cron */5 * * * * check ci status");
	assert.ok(parsed);
	assert.equal(parsed.prompt, "check ci status");
	assert.equal(parsed.recurring.mode, "cron");
	if (parsed.recurring.mode === "cron") {
		assert.equal(parsed.recurring.cronExpression, "0 */5 * * * *");
	}
});

test("parseLoopScheduleArgs parses explicit cron with quoted 6-field expression", () => {
	const parsed = parseLoopScheduleArgs("cron '0 */10 * * * *' check deployment");
	assert.ok(parsed);
	assert.equal(parsed.prompt, "check deployment");
	assert.equal(parsed.recurring.mode, "cron");
	if (parsed.recurring.mode === "cron") {
		assert.equal(parsed.recurring.cronExpression, "0 */10 * * * *");
	}
});

test("parseLoopScheduleArgs returns undefined for invalid explicit cron syntax", () => {
	const parsed = parseLoopScheduleArgs("cron nope check deployment");
	assert.equal(parsed, undefined);
});

test("parseLoopScheduleArgs preserves interval parsing", () => {
	const parsed = parseLoopScheduleArgs("check build every 2h");
	assert.ok(parsed);
	assert.equal(parsed.prompt, "check build");
	assert.equal(parsed.recurring.mode, "interval");
	if (parsed.recurring.mode === "interval") {
		assert.equal(parsed.recurring.durationMs, 2 * 60 * 60 * 1000);
	}
});

test("parseLoopScheduleArgs defaults to 10m interval", () => {
	const parsed = parseLoopScheduleArgs("check build status");
	assert.ok(parsed);
	assert.equal(parsed.prompt, "check build status");
	assert.equal(parsed.recurring.mode, "interval");
	if (parsed.recurring.mode === "interval") {
		assert.equal(parsed.recurring.durationMs, 10 * 60 * 1000);
	}
});

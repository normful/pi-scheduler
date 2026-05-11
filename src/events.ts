import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { SchedulerRuntime } from "./runtime";

export function registerEvents(pi: ExtensionAPI, runtime: SchedulerRuntime) {
	pi.on("session_start", async (event, ctx) => {
		runtime.setRuntimeContext(ctx);
		// Only start scheduler on initial startup, not for session switches/forks
		if (event.reason === "startup") {
			runtime.startScheduler();
		}
		runtime.updateStatus();
	});

	pi.on("session_tree", async (_event, ctx) => {
		runtime.setRuntimeContext(ctx);
		runtime.updateStatus();
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		runtime.setRuntimeContext(ctx);
		runtime.stopScheduler();
		runtime.clearStatus(ctx);
	});
}

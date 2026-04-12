import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerCommands } from "./commands";
import { registerEvents } from "./events";
import { SchedulerRuntime } from "./runtime";
import { registerTools } from "./tools";

export {
	computeNextCronRunAt,
	loopArgumentCompletions,
	normalizeCronExpression,
	parseLoopScheduleArgs,
	validateSchedulePromptAddInput,
} from "./scheduling";

export default function schedulerExtension(pi: ExtensionAPI) {
	const runtime = new SchedulerRuntime(pi);
	registerEvents(pi, runtime);
	registerCommands(pi, runtime);

	// Register tools only on demand via /load-scheduler-tool command
	pi.registerCommand("load-schedule-tool", {
		description:
			"Load `schedule` tool to create/list/delete/disable/enable scheduled and recurring prompts",
		handler: async (_args, ctx) => {
			registerTools(pi, runtime);
			ctx.ui.notify("Registered `schedule` tool.", "info");
		},
	});
}

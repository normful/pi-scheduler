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
	pi.registerCommand("load-scheduler-tool", {
		description:
			"Register the scheduler tool. The scheduler tool allows creating/list/enabling/disabling/deleting scheduled prompts and reminders.",
		handler: async (_args, ctx) => {
			registerTools(pi, runtime);
			ctx.ui.notify("Registered scheduler tool.", "info");
		},
	});
}

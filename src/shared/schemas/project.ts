import { z } from "zod";

export const ProjectInfoSchema = z.object({
	name: z.string(),
	path: z.string(),
	displayPath: z.string(),
	hasIcon: z.boolean(),
});

export type ProjectInfo = z.infer<typeof ProjectInfoSchema>;

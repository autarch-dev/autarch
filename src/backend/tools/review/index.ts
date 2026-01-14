/**
 * Review tools - Code review tools for the review agent
 */

export {
	type AddFileCommentInput,
	addFileCommentInputSchema,
	addFileCommentTool,
} from "./addFileComment";

export {
	type AddCommentOutput,
	type AddLineCommentInput,
	addLineCommentInputSchema,
	addLineCommentTool,
} from "./addLineComment";

export {
	type AddReviewCommentInput,
	addReviewCommentInputSchema,
	addReviewCommentTool,
} from "./addReviewComment";

export {
	type CompleteReviewInput,
	type CompleteReviewOutput,
	completeReviewInputSchema,
	completeReviewTool,
} from "./completeReview";

export {
	type GetDiffInput,
	type GetDiffOutput,
	getDiffInputSchema,
	getDiffTool,
} from "./getDiff";

export {
	type GetScopeCardInput,
	type GetScopeCardOutput,
	getScopeCardInputSchema,
	getScopeCardTool,
} from "./getScopeCard";

// Array of all review tools (registered for type-erased storage)
import { registerTool } from "../types";
import { addFileCommentTool } from "./addFileComment";
import { addLineCommentTool } from "./addLineComment";
import { addReviewCommentTool } from "./addReviewComment";
import { completeReviewTool } from "./completeReview";
import { getDiffTool } from "./getDiff";
import { getScopeCardTool } from "./getScopeCard";

export const reviewTools = [
	registerTool(getDiffTool),
	registerTool(getScopeCardTool),
	registerTool(addLineCommentTool),
	registerTool(addFileCommentTool),
	registerTool(addReviewCommentTool),
	registerTool(completeReviewTool),
];

import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

// Import all migrations in execution order
import { migrate as migrate0000ProjectMeta } from "./0000-project-meta";
import { migrate as migrate0001Channels } from "./0001-channels";
import { migrate as migrate0002Workflows } from "./0002-workflows";
import { migrate as migrate0003ScopeCards } from "./0003-scope-cards";
import { migrate as migrate0004ResearchCards } from "./0004-research-cards";
import { migrate as migrate0005Plans } from "./0005-plans";
import { migrate as migrate0006Pulses } from "./0006-pulses";
import { migrate as migrate0007PreflightSetup } from "./0007-preflight-setup";
import { migrate as migrate0008PreflightBaselines } from "./0008-preflight-baselines";
import { migrate as migrate0009PreflightCommandBaselines } from "./0009-preflight-command-baselines";
import { migrate as migrate0010Sessions } from "./0010-sessions";
import { migrate as migrate0011SessionNotes } from "./0011-session-notes";
import { migrate as migrate0012Turns } from "./0012-turns";
import { migrate as migrate0013TurnMessages } from "./0013-turn-messages";
import { migrate as migrate0014TurnTools } from "./0014-turn-tools";
import { migrate as migrate0015TurnThoughts } from "./0015-turn-thoughts";
import { migrate as migrate0016Questions } from "./0016-questions";
import { migrate as migrate0017ArtifactStatusColumns } from "./0017-artifact-status-columns";
import { migrate as migrate0018VerificationInstructionsColumn } from "./0018-verification-instructions-column";
import { migrate as migrate0019VerificationCommandsColumn } from "./0019-verification-commands-column";
import { migrate as migrate0020BaseBranchColumn } from "./0020-base-branch-column";
import { migrate as migrate0021ReviewCards } from "./0021-review-cards";
import { migrate as migrate0022ReviewComments } from "./0022-review-comments";
import { migrate as migrate0023ArtifactTurnIdColumns } from "./0023-artifact-turn-id-columns";
import { migrate as migrate0024TurnTokenUsageColumns } from "./0024-turn-token-usage-columns";
import { migrate as migrate0025ReviewCommentsAuthorColumn } from "./0025-review-comments-author-column";
import { migrate as migrate0026SuggestedCommitMessageColumn } from "./0026-suggested-commit-message-column";
import { migrate as migrate0027ArchivedColumn } from "./0027-archived-column";
import { migrate as migrate0028SkippedStagesColumn } from "./0028-skipped-stages-column";
import { migrate as migrate0029RemoveReviewCommentConstraints } from "./0029-remove-review-comment-constraints";
import { migrate as migrate0030ReviewCardDiffContentColumn } from "./0030-review-card-diff-content-column";
import { migrate as migrate0031PulseIdSessionsColumn } from "./0031-pulse-id-sessions-column";

/**
 * Run all migrations for the project database.
 * Migrations are executed sequentially in the order they were added.
 * Each migration is idempotent (safe to run multiple times).
 */
export async function migrateProjectDb(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	// Core table creation (0000-0016)
	await migrate0000ProjectMeta(db);
	await migrate0001Channels(db);
	await migrate0002Workflows(db);
	await migrate0003ScopeCards(db);
	await migrate0004ResearchCards(db);
	await migrate0005Plans(db);
	await migrate0006Pulses(db);
	await migrate0007PreflightSetup(db);
	await migrate0008PreflightBaselines(db);
	await migrate0009PreflightCommandBaselines(db);
	await migrate0010Sessions(db);
	await migrate0011SessionNotes(db);
	await migrate0012Turns(db);
	await migrate0013TurnMessages(db);
	await migrate0014TurnTools(db);
	await migrate0015TurnThoughts(db);
	await migrate0016Questions(db);

	// Column additions and schema modifications (0017-0031)
	await migrate0017ArtifactStatusColumns(db);
	await migrate0018VerificationInstructionsColumn(db);
	await migrate0019VerificationCommandsColumn(db);
	await migrate0020BaseBranchColumn(db);
	await migrate0021ReviewCards(db);
	await migrate0022ReviewComments(db);
	await migrate0023ArtifactTurnIdColumns(db);
	await migrate0024TurnTokenUsageColumns(db);
	await migrate0025ReviewCommentsAuthorColumn(db);
	await migrate0026SuggestedCommitMessageColumn(db);
	await migrate0027ArchivedColumn(db);
	await migrate0028SkippedStagesColumn(db);
	await migrate0029RemoveReviewCommentConstraints(db);
	await migrate0030ReviewCardDiffContentColumn(db);
	await migrate0031PulseIdSessionsColumn(db);
}

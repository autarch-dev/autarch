/**
 * Hard-block patterns for shell commands.
 *
 * When a command matches any pattern here, it forces a manual approval prompt
 * with a prominent warning — regardless of the project's shell approval mode,
 * including Yolo. The intent is a safety net of last resort against catastrophic,
 * irreversible operations. Matches do NOT auto-deny — the user can still approve.
 *
 * Bias: prefer false positives (annoying prompts on benign-looking variants) over
 * false negatives (silent destruction in Yolo). If a pattern is unsure, it should
 * still match.
 */

interface HardBlockPattern {
	pattern: RegExp;
	label: string;
}

/**
 * System paths whose recursive deletion would brick the machine or wipe user data.
 * Matches `/<dir>` followed by end-of-string, whitespace, or `/`.
 */
const SYSTEM_PATHS_PATTERN =
	"/(?:usr|etc|bin|sbin|var|lib|boot|root|opt|dev|proc|sys|Users|System|Library|home)(?:/|\\s|$)";

const PATTERNS: HardBlockPattern[] = [
	// ---------------------------------------------------------------------------
	// Mass filesystem destruction
	// ---------------------------------------------------------------------------
	{
		// rm -rf / (with / followed by end, whitespace, or *)
		pattern:
			/\brm\s+(?:-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|--recursive\s+--force|--force\s+--recursive)[^\n]*\s\/(?:\s|\*|$)/,
		label: "Recursive delete of root filesystem",
	},
	{
		// rm -rf <system-path>
		pattern: new RegExp(
			`\\brm\\s+(?:-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|--recursive\\s+--force|--force\\s+--recursive)[^\\n]*\\s${SYSTEM_PATHS_PATTERN}`,
		),
		label: "Recursive delete of a system directory",
	},
	{
		// rm -rf ~ or rm -rf $HOME
		pattern:
			/\brm\s+(?:-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)[^\n]*\s(?:~|\$HOME)(?:\s|$)/,
		label: "Recursive delete of home directory",
	},

	// ---------------------------------------------------------------------------
	// Disk / device wipes
	// ---------------------------------------------------------------------------
	{
		// dd writing to a block device
		pattern:
			/\bdd\s+[^\n]*\bof=\/dev\/(?:sd[a-z]|disk\d|nvme\d|hd[a-z]|mmcblk\d)/,
		label: "Direct write to a block device (dd)",
	},
	{
		// mkfs against a block device (any filesystem variant)
		pattern:
			/\bmkfs(?:\.\w+)?\s+[^\n]*\/dev\/(?:sd[a-z]|disk\d|nvme\d|hd[a-z]|mmcblk\d)/,
		label: "Format a block device (mkfs)",
	},
	{
		// Shell redirect to a block device
		pattern: />\s*\/dev\/(?:sd[a-z]|disk\d|nvme\d|hd[a-z]|mmcblk\d)/,
		label: "Shell redirect to a block device",
	},

	// ---------------------------------------------------------------------------
	// Fork bombs
	// ---------------------------------------------------------------------------
	{
		// Classic bash fork bomb: :(){ :|:& };:
		pattern: /:\s*\(\s*\)\s*\{[^}]*:\s*\|\s*:\s*&[^}]*\}\s*;\s*:/,
		label: "Bash fork bomb",
	},

	// ---------------------------------------------------------------------------
	// Privilege / key compromise
	// ---------------------------------------------------------------------------
	{
		// Writing to ~/.ssh/authorized_keys (either > or >>)
		pattern:
			/>>?\s*(?:~|\$HOME|\/root|\/home\/[^/\s]+|\/Users\/[^/\s]+)\/\.ssh\/authorized_keys/,
		label: "Modifying SSH authorized_keys",
	},

	// ---------------------------------------------------------------------------
	// Pipe-to-shell from network
	// ---------------------------------------------------------------------------
	{
		// curl ... | sh|bash|zsh|fish
		pattern:
			/\b(?:curl|wget|fetch)\s+[^\n|]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|fish|ksh|dash)(?:\s|$)/,
		label: "Piping network content directly to a shell",
	},

	// ---------------------------------------------------------------------------
	// Force-push to protected branches
	// ---------------------------------------------------------------------------
	{
		// git push --force or -f targeting main or master
		pattern:
			/\bgit\s+push\b[^\n]*(?:\s-f\b|\s--force\b|\s--force-with-lease\b)[^\n]*\b(?:main|master)\b/,
		label: "Force-push to main/master",
	},
	{
		// Same but with branch name before the flag
		pattern:
			/\bgit\s+push\b[^\n]*\b(?:main|master)\b[^\n]*(?:\s-f\b|\s--force\b|\s--force-with-lease\b)/,
		label: "Force-push to main/master",
	},

	// ---------------------------------------------------------------------------
	// Catastrophic permission changes
	// ---------------------------------------------------------------------------
	{
		// chmod -R 777 against / or a system path
		pattern: new RegExp(
			`\\bchmod\\s+(?:-R\\s+|--recursive\\s+)[0-7]{3,4}[^\\n]*\\s(?:\\/(?:\\s|$)|${SYSTEM_PATHS_PATTERN})`,
		),
		label: "Recursive chmod of root or a system directory",
	},
];

export interface HardBlockMatch {
	matched: boolean;
	label?: string;
}

/**
 * Check whether a command matches any hard-block pattern.
 *
 * @param command - The shell command to test
 * @returns Match result with the label of the first matching pattern, if any
 */
export function matchHardBlock(command: string): HardBlockMatch {
	for (const { pattern, label } of PATTERNS) {
		if (pattern.test(command)) {
			return { matched: true, label };
		}
	}
	return { matched: false };
}

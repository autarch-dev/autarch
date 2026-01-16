import type {
	Author,
	LegacyChannel,
	Message,
	Workflow,
	WorkflowMessage,
} from "./types";

// Mock Authors
export const authors = {
	user: {
		id: "user-1",
		name: "You",
		avatar: undefined,
		isAI: false,
	},
	autarch: {
		id: "autarch",
		name: "Autarch",
		avatar: undefined,
		isAI: true,
	},
} as const satisfies Record<string, Author>;

// Mock Channels
export const mockChannels: LegacyChannel[] = [
	{
		id: "general",
		name: "general",
		description: "General discussion about the codebase",
		unreadCount: 0,
	},
	{
		id: "architecture",
		name: "architecture",
		description: "Discuss architectural decisions",
		unreadCount: 2,
	},
	{
		id: "bugs",
		name: "bugs",
		description: "Track and discuss bugs",
		unreadCount: 0,
	},
	{
		id: "performance",
		name: "performance",
		description: "Performance optimizations",
		unreadCount: 1,
	},
];

// Mock Messages for the general channel
export const mockMessages: Message[] = [
	{
		id: "msg-1",
		channelId: "general",
		content: "How does the authentication flow work in this codebase?",
		author: authors.user,
		timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
	},
	{
		id: "msg-2",
		channelId: "general",
		content: `The authentication flow in this codebase uses a session-based approach. Here's how it works:

1. **Login Request**: User submits credentials to \`/api/auth/login\`
2. **Session Creation**: Server validates and creates a session stored in SQLite
3. **Cookie Setting**: A secure HTTP-only cookie is set with the session ID
4. **Middleware Verification**: Each protected route checks the session via middleware

The key files involved are:`,
		author: authors.autarch,
		timestamp: new Date(Date.now() - 1000 * 60 * 28),
		isAI: true,
		codeReferences: [
			{
				file: "src/backend/services/auth.ts",
				startLine: 24,
				endLine: 45,
				snippet:
					"export async function createSession(userId: string) {\n  // ...\n}",
			},
		],
	},
	{
		id: "msg-3",
		channelId: "general",
		content:
			"Got it! Can you show me where the session middleware validates the token?",
		author: authors.user,
		timestamp: new Date(Date.now() - 1000 * 60 * 15),
	},
	{
		id: "msg-4",
		channelId: "general",
		content: `Sure! The session validation happens in the middleware. Here's the relevant code:

\`\`\`typescript
export const authMiddleware = async (req: Request) => {
  const sessionId = req.cookies.get("session_id");
  if (!sessionId) return null;
  
  const session = await db.sessions.findById(sessionId);
  if (!session || session.expiresAt < new Date()) {
    return null;
  }
  
  return session.userId;
};
\`\`\`

This middleware is applied to all protected routes in \`src/backend/routes/index.ts\`.`,
		author: authors.autarch,
		timestamp: new Date(Date.now() - 1000 * 60 * 12),
		isAI: true,
	},
];

// Mock Workflows
export const mockWorkflows: Workflow[] = [
	{
		id: "wf-1",
		title: "Add user profile settings page",
		description:
			"Create a new settings page where users can update their profile information",
		status: "in_progress",
		priority: "high",
		createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
		updatedAt: new Date(Date.now() - 1000 * 60 * 30),
		messages: [],
	},
	{
		id: "wf-2",
		title: "Implement caching layer for API responses",
		description: "Add Redis caching to improve API response times",
		status: "researching",
		priority: "medium",
		createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
		updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
		messages: [],
	},
	{
		id: "wf-3",
		title: "Fix memory leak in WebSocket handler",
		description: "Investigate and fix the memory leak reported in production",
		status: "scoping",
		priority: "urgent",
		createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
		updatedAt: new Date(Date.now() - 1000 * 60 * 60),
		messages: [],
	},
	{
		id: "wf-4",
		title: "Refactor database schema for multi-tenancy",
		description: "Update the database schema to support multiple organizations",
		status: "planning",
		priority: "medium",
		createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
		updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
		messages: [],
	},
	{
		id: "wf-5",
		title: "Add dark mode toggle",
		description: "Implement system and manual dark mode switching",
		status: "done",
		priority: "low",
		createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
		updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
		messages: [],
	},
	{
		id: "wf-6",
		title: "Setup CI/CD pipeline",
		description:
			"Configure GitHub Actions for automated testing and deployment",
		status: "backlog",
		priority: "medium",
		createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
		updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
		messages: [],
	},
];

// Mock Workflow Messages for the first workflow
export const mockWorkflowMessages: WorkflowMessage[] = [
	{
		id: "wfm-1",
		workflowId: "wf-1",
		content: "I need to add a user profile settings page to the app.",
		author: authors.user,
		timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
	},
	{
		id: "wfm-2",
		workflowId: "wf-1",
		content: `I'll help you create a user profile settings page. Let me start by researching the current codebase structure and identifying the best approach.

**Scoping Phase Complete** ✓

Based on my analysis, here's what we need:
- A new route at \`/settings/profile\`
- A form component with fields for name, email, avatar
- Integration with the existing user API
- Form validation using react-hook-form + zod`,
		author: authors.autarch,
		timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2 + 1000 * 60 * 5),
		isAI: true,
		phase: "scoping",
	},
	{
		id: "wfm-3",
		workflowId: "wf-1",
		content: `**Research Phase Complete** ✓

I've analyzed the existing patterns in the codebase:

1. **Form patterns**: Using \`react-hook-form\` with Zod schemas (see onboarding wizard)
2. **API patterns**: REST endpoints with Zod validation on both client and server
3. **Component structure**: Feature-based organization in \`src/features/\`

Existing components we can reuse:
- \`Input\`, \`Label\`, \`Button\` from \`@/components/ui\`
- Form validation patterns from \`src/features/onboarding/\``,
		author: authors.autarch,
		timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 + 1000 * 60 * 30),
		isAI: true,
		phase: "researching",
		artifacts: [
			{
				type: "research",
				title: "Codebase Analysis",
				content: "Found 3 similar form implementations to reference...",
			},
		],
	},
	{
		id: "wfm-4",
		workflowId: "wf-1",
		content: "Looks good! Let's proceed with the plan.",
		author: authors.user,
		timestamp: new Date(Date.now() - 1000 * 60 * 60 * 20),
	},
	{
		id: "wfm-5",
		workflowId: "wf-1",
		content: `**Planning Phase Complete** ✓

Here's the implementation plan:

### Files to Create
1. \`src/features/settings/index.ts\` - Public exports
2. \`src/features/settings/ProfileSettings.tsx\` - Main component
3. \`src/features/settings/components/ProfileForm.tsx\` - Form component
4. \`src/features/settings/api/profileApi.ts\` - API client
5. \`src/shared/schemas/profile.ts\` - Zod schemas
6. \`src/backend/routes/profile.ts\` - API routes

### Files to Modify
1. \`src/App.tsx\` - Add route
2. \`src/backend/index.ts\` - Register API routes

Ready to start implementation?`,
		author: authors.autarch,
		timestamp: new Date(Date.now() - 1000 * 60 * 60 * 18),
		isAI: true,
		phase: "planning",
		artifacts: [
			{
				type: "plan",
				title: "Implementation Plan",
				content: "8 files total: 6 new, 2 modified",
			},
		],
	},
	{
		id: "wfm-6",
		workflowId: "wf-1",
		content: "Yes, let's do it!",
		author: authors.user,
		timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
	},
	{
		id: "wfm-7",
		workflowId: "wf-1",
		content: `**Implementation in Progress** 🔄

I'm now creating the profile settings feature. Here's my progress:

✅ Created \`src/shared/schemas/profile.ts\`
✅ Created \`src/features/settings/api/profileApi.ts\`
✅ Created \`src/features/settings/components/ProfileForm.tsx\`
🔄 Working on \`src/features/settings/ProfileSettings.tsx\`
⏳ Pending: Route integration
⏳ Pending: Backend API routes`,
		author: authors.autarch,
		timestamp: new Date(Date.now() - 1000 * 60 * 30),
		isAI: true,
		phase: "in_progress",
	},
];

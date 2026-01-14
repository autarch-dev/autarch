/**
 * Types for the Project Dashboard
 */

// Discussion Channels (Slack-like)
export interface Channel {
	id: string;
	name: string;
	description?: string;
	unreadCount?: number;
	lastActivity?: Date;
}

export interface Message {
	id: string;
	channelId: string;
	content: string;
	author: Author;
	timestamp: Date;
	isAI?: boolean;
	codeReferences?: CodeReference[];
}

export interface CodeReference {
	file: string;
	startLine: number;
	endLine: number;
	snippet: string;
}

export interface Author {
	id: string;
	name: string;
	avatar?: string;
	isAI?: boolean;
}

// Workflows (Linear-like)
export type WorkflowStatus =
	| "backlog"
	| "scoping"
	| "researching"
	| "planning"
	| "in_progress"
	| "review"
	| "done";

export interface Workflow {
	id: string;
	title: string;
	description?: string;
	status: WorkflowStatus;
	priority: "low" | "medium" | "high" | "urgent";
	createdAt: Date;
	updatedAt: Date;
	messages: WorkflowMessage[];
}

export interface WorkflowMessage {
	id: string;
	workflowId: string;
	content: string;
	author: Author;
	timestamp: Date;
	isAI?: boolean;
	phase?: WorkflowStatus;
	artifacts?: WorkflowArtifact[];
}

export interface WorkflowArtifact {
	type: "plan" | "code" | "diff" | "research";
	title: string;
	content: string;
}

// Navigation
export type ViewType = "channel" | "workflow";

export interface NavigationState {
	view: ViewType;
	selectedId: string | null;
}

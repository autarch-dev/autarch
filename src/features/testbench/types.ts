/**
 * Types for the Tool Testbench feature
 *
 * Defines interfaces for JSON Schema representation and tool execution results.
 */

// =============================================================================
// JSON Schema Types
// =============================================================================

/**
 * Represents a property in a JSON Schema.
 * Used for dynamic form generation from tool input schemas.
 */
export interface JSONSchemaProperty {
	/** The type of the property (string, number, boolean, array, object) */
	type: string;
	/** Human-readable description of the property */
	description?: string;
	/** Enum values if the property is constrained to specific values */
	enum?: string[];
	/** Schema for array items (when type is 'array') */
	items?: JSONSchemaProperty;
	/** Nested properties (when type is 'object') */
	properties?: Record<string, JSONSchemaProperty>;
	/** Required property names (when type is 'object') */
	required?: string[];
	/** Default value for the property */
	default?: unknown;
}

// =============================================================================
// Tool Schema Types
// =============================================================================

/**
 * Represents a tool's schema for display and form generation.
 * Contains the tool metadata and its JSON Schema representation.
 */
export interface ToolSchema {
	/** Unique tool name (snake_case) */
	name: string;
	/** Human-readable description for display */
	description: string;
	/** JSON Schema for the tool's input parameters */
	schema: {
		/** Property definitions */
		properties: Record<string, JSONSchemaProperty>;
		/** Names of required properties (optional per JSON Schema spec) */
		required?: string[];
	};
}

// =============================================================================
// Execution Types
// =============================================================================

/**
 * Result of executing a tool.
 * Mirrors the backend ToolResult structure.
 */
export interface ToolExecutionResult {
	/** Whether the tool execution succeeded */
	success: boolean;
	/** The output from the tool (plain text) */
	output: string;
}

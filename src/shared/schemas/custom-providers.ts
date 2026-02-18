import { z } from "zod";

// =============================================================================
// Custom Provider
// =============================================================================

export const CustomProviderSchema = z.object({
	id: z
		.string()
		.regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens")
		.min(1)
		.max(64),
	label: z.string().min(1).max(128),
	baseUrl: z.url(),
	headersJson: z.record(z.string(), z.string()).optional(),
});
export type CustomProvider = z.infer<typeof CustomProviderSchema>;

export const CreateCustomProviderRequestSchema = CustomProviderSchema;
export type CreateCustomProviderRequest = CustomProvider;

export const UpdateCustomProviderRequestSchema = CustomProviderSchema.omit({
	id: true,
}).partial();
export type UpdateCustomProviderRequest = z.infer<
	typeof UpdateCustomProviderRequestSchema
>;

// =============================================================================
// Custom Model
// =============================================================================

export const CustomModelSchema = z.object({
	id: z.string(),
	providerId: z.string(),
	modelName: z.string().min(1),
	label: z.string().min(1).max(128),
	promptTokenCost: z.number().min(0),
	completionTokenCost: z.number().min(0),
	cacheReadCost: z.number().min(0).optional(),
	cacheWriteCost: z.number().min(0).optional(),
});
export type CustomModel = z.infer<typeof CustomModelSchema>;

export const CreateCustomModelRequestSchema = CustomModelSchema.omit({
	id: true,
	providerId: true,
});
export type CreateCustomModelRequest = z.infer<
	typeof CreateCustomModelRequestSchema
>;

export const UpdateCustomModelRequestSchema = CustomModelSchema.omit({
	id: true,
	providerId: true,
}).partial();
export type UpdateCustomModelRequest = z.infer<
	typeof UpdateCustomModelRequestSchema
>;

// =============================================================================
// API Key
// =============================================================================

export const SetCustomProviderApiKeyRequestSchema = z.object({
	key: z.string().min(1, "API key is required"),
});
export type SetCustomProviderApiKeyRequest = z.infer<
	typeof SetCustomProviderApiKeyRequestSchema
>;

// =============================================================================
// Responses
// =============================================================================

export const CustomProvidersListResponseSchema = z.array(CustomProviderSchema);
export type CustomProvidersListResponse = z.infer<
	typeof CustomProvidersListResponseSchema
>;

export const CustomModelsListResponseSchema = z.array(CustomModelSchema);
export type CustomModelsListResponse = z.infer<
	typeof CustomModelsListResponseSchema
>;

export const CustomProviderKeysStatusSchema = z.record(z.string(), z.boolean());
export type CustomProviderKeysStatus = z.infer<
	typeof CustomProviderKeysStatusSchema
>;

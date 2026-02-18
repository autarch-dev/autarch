/**
 * Global database schema types
 */
export interface GlobalDatabase {
	settings: SettingsTable;
	custom_providers: CustomProvidersTable;
	custom_models: CustomModelsTable;
}

export interface SettingsTable {
	key: string;
	value: string;
	updated_at: number;
}

export interface CustomProvidersTable {
	id: string;
	label: string;
	base_url: string;
	headers_json: string | null;
	created_at: number;
	updated_at: number;
}

export interface CustomModelsTable {
	id: string;
	provider_id: string;
	model_name: string;
	label: string;
	prompt_token_cost: number;
	completion_token_cost: number;
	cache_read_cost: number | null;
	cache_write_cost: number | null;
	created_at: number;
	updated_at: number;
}

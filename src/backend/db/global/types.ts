/**
 * Global database schema types
 */
export interface GlobalDatabase {
	settings: SettingsTable;
}

export interface SettingsTable {
	key: string;
	value: string;
	updated_at: number;
}

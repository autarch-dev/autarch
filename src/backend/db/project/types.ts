/**
 * Project database schema types
 */
export interface ProjectDatabase {
	project_meta: ProjectMetaTable;
}

export interface ProjectMetaTable {
	key: string;
	value: string;
	updated_at: number;
}

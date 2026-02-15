/**
 * Knowledge Service - Barrel Export
 *
 * Re-exports the main public APIs from the knowledge extraction system.
 */

export { KNOWLEDGE_CONFIG } from "./config";
export { extractKnowledge } from "./extraction";
export {
	type CreateKnowledgeItemData,
	type KnowledgeItem,
	KnowledgeRepository,
	type KnowledgeSearchFilters,
} from "./repository";
export {
	type KnowledgeSearchResult,
	type SearchFilters,
	searchKnowledge,
} from "./search";

/**
 * ChannelRepository - Data access for discussion channels
 *
 * Consolidates all channel database operations and provides
 * consistent domain object mapping.
 */

import type { ChannelsTable } from "@/backend/db/project/types";
import { ids } from "@/backend/utils";
import type { Channel } from "@/shared/schemas/channel";
import type { ProjectDb, Repository } from "./types";

// =============================================================================
// Repository
// =============================================================================

export class ChannelRepository implements Repository {
	constructor(readonly db: ProjectDb) {}

	// ===========================================================================
	// Domain Mapping
	// ===========================================================================

	/**
	 * Convert a database row to a domain Channel object.
	 * Single source of truth for this mapping.
	 */
	private toChannel(row: ChannelsTable): Channel {
		return {
			id: row.id,
			name: row.name,
			description: row.description ?? undefined,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	// ===========================================================================
	// Read Operations
	// ===========================================================================

	/**
	 * Get a channel by ID
	 */
	async getById(id: string): Promise<Channel | null> {
		const row = await this.db
			.selectFrom("channels")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		return row ? this.toChannel(row) : null;
	}

	/**
	 * Get a channel by name
	 */
	async getByName(name: string): Promise<Channel | null> {
		const row = await this.db
			.selectFrom("channels")
			.selectAll()
			.where("name", "=", name)
			.executeTakeFirst();

		return row ? this.toChannel(row) : null;
	}

	/**
	 * Check if a channel name already exists
	 */
	async nameExists(name: string): Promise<boolean> {
		const row = await this.db
			.selectFrom("channels")
			.select("id")
			.where("name", "=", name)
			.executeTakeFirst();

		return !!row;
	}

	/**
	 * List all channels, ordered by name
	 */
	async list(): Promise<Channel[]> {
		const rows = await this.db
			.selectFrom("channels")
			.selectAll()
			.orderBy("name", "asc")
			.execute();

		return rows.map((row) => this.toChannel(row));
	}

	// ===========================================================================
	// Write Operations
	// ===========================================================================

	/**
	 * Create a new channel
	 */
	async create(name: string, description?: string): Promise<Channel> {
		const now = Date.now();
		const channelId = ids.channel();

		await this.db
			.insertInto("channels")
			.values({
				id: channelId,
				name,
				description: description ?? null,
				created_at: now,
				updated_at: now,
			})
			.execute();

		// Return the created channel
		const channel = await this.getById(channelId);
		if (!channel) {
			throw new Error(`Failed to create channel: ${channelId}`);
		}
		return channel;
	}

	/**
	 * Delete a channel by ID
	 */
	async delete(id: string): Promise<boolean> {
		const [result] = await this.db
			.deleteFrom("channels")
			.where("id", "=", id)
			.execute();

		return !!result && result.numDeletedRows > 0;
	}
}

/**
 * Tests for ChannelRepository
 *
 * Tests all 6 public methods: create, getById, getByName, nameExists, list, delete.
 * Uses createTestDb() in beforeEach for a fresh in-memory database per test.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../../db/project/types";
import type { Repositories } from "../types";
import { createTestDb, destroyTestDb } from "./helper";

let db: Kysely<ProjectDatabase>;
let repos: Repositories;

beforeEach(async () => {
	const testDb = await createTestDb();
	db = testDb.db;
	repos = testDb.repos;
});

afterEach(async () => {
	await destroyTestDb(db);
});

describe("ChannelRepository", () => {
	describe("create", () => {
		test("inserts a channel and returns it with correct camelCase fields", async () => {
			const channel = await repos.channels.create("general", "Main channel");

			expect(channel.id).toMatch(/^channel_/);
			expect(channel.name).toBe("general");
			expect(channel.description).toBe("Main channel");
			expect(typeof channel.createdAt).toBe("number");
			expect(typeof channel.updatedAt).toBe("number");
			expect(channel.createdAt).toBe(channel.updatedAt);
		});

		test("creates a channel without description", async () => {
			const channel = await repos.channels.create("no-desc");

			expect(channel.id).toMatch(/^channel_/);
			expect(channel.name).toBe("no-desc");
			expect(channel.description).toBeUndefined();
		});
	});

	describe("getById", () => {
		test("retrieves a channel by ID with all fields", async () => {
			const created = await repos.channels.create(
				"test-channel",
				"A test channel",
			);

			const found = await repos.channels.getById(created.id);

			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
			expect(found?.name).toBe("test-channel");
			expect(found?.description).toBe("A test channel");
			expect(found?.createdAt).toBe(created.createdAt);
			expect(found?.updatedAt).toBe(created.updatedAt);
		});

		test("returns null for non-existent ID", async () => {
			const found = await repos.channels.getById("channel_nonexistent_000000");

			expect(found).toBeNull();
		});
	});

	describe("getByName", () => {
		test("retrieves a channel by name", async () => {
			const created = await repos.channels.create(
				"find-me",
				"Find this channel",
			);

			const found = await repos.channels.getByName("find-me");

			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
			expect(found?.name).toBe("find-me");
			expect(found?.description).toBe("Find this channel");
		});

		test("returns null for non-existent name", async () => {
			const found = await repos.channels.getByName("does-not-exist");

			expect(found).toBeNull();
		});
	});

	describe("nameExists", () => {
		test("returns true for an existing channel name", async () => {
			await repos.channels.create("existing-channel");

			const exists = await repos.channels.nameExists("existing-channel");

			expect(exists).toBe(true);
		});

		test("returns false for a non-existent channel name", async () => {
			const exists = await repos.channels.nameExists("no-such-channel");

			expect(exists).toBe(false);
		});
	});

	describe("list", () => {
		test("returns all channels sorted by name ascending", async () => {
			await repos.channels.create("charlie");
			await repos.channels.create("alpha");
			await repos.channels.create("bravo");

			const channels = await repos.channels.list();

			expect(channels).toHaveLength(3);
			expect(channels[0]?.name).toBe("alpha");
			expect(channels[1]?.name).toBe("bravo");
			expect(channels[2]?.name).toBe("charlie");
		});

		test("returns empty array when no channels exist", async () => {
			const channels = await repos.channels.list();

			expect(channels).toHaveLength(0);
		});
	});

	describe("delete", () => {
		test("removes a channel so getById returns null", async () => {
			const created = await repos.channels.create("to-delete");

			const deleted = await repos.channels.delete(created.id);

			expect(deleted).toBe(true);
			const found = await repos.channels.getById(created.id);
			expect(found).toBeNull();
		});

		test("returns false when deleting a non-existent ID", async () => {
			const deleted = await repos.channels.delete("channel_nonexistent_000000");

			expect(deleted).toBe(false);
		});
	});
});

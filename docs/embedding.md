# Embedding Engine

The embedding engine provides semantic search capabilities over project codebases. It generates vector embeddings from source code and documentation, enabling similarity-based retrieval for context-aware AI interactions.

## Overview

The embedding system consists of four main components:

1. **OnnxEmbeddingProvider** - Generates vector embeddings from text using ONNX Runtime
2. **TextChunker** - Splits files into token-bounded chunks suitable for embedding
3. **VectorSimilaritySearch** - Performs cosine similarity search over embeddings
4. **EmbeddingIndexService** - Orchestrates indexing, scope management, and search

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     EmbeddingIndexService                       │
│  (Orchestration: indexing, scopes, file tracking, search)       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────────────┐
│  TextChunker  │   │OnnxEmbedding- │   │VectorSimilaritySearch │
│ (512 tokens/  │   │   Provider    │   │  (Cosine similarity)  │
│    chunk)     │   │ (768-dim vec) │   │                       │
└───────────────┘   └───────────────┘   └───────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  ONNX Model   │
                    │ (nomic-embed- │
                    │  text-v1.5)   │
                    └───────────────┘
```

## Embedding Model

The engine uses **nomic-embed-text-v1.5**, a state-of-the-art text embedding model:

| Property | Value |
|----------|-------|
| Dimensions | 768 |
| Max tokens | 8,192 |
| Tokenizer | BERT (WordPiece) |
| Normalization | L2 normalized |
| Pooling | Mean pooling over attention mask |

### Hardware Acceleration

The provider automatically selects the best available execution provider:

- **macOS**: CoreML (Apple Neural Engine / GPU)
- **Windows/Linux**: CUDA (NVIDIA GPU)
- **Fallback**: CPU with optimized thread pool (75% of cores)

If hardware acceleration fails, the system gracefully falls back to CPU inference with transformer-specific graph optimizations enabled.

## Text Chunking

Files are split into overlapping chunks to preserve context across boundaries:

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Target tokens | 512 | Optimal size for embedding quality |
| Overlap tokens | 64 | Context continuity between chunks |
| Max line length | 1,000 chars | Skip generated/minified lines |
| Max file size | 512 KB | Skip large generated files |

### Chunking Algorithm

1. Split file content by newlines
2. Accumulate lines until target token count is reached
3. Create chunk with line number metadata
4. Back up by overlap tokens for next chunk start
5. Repeat until end of file

Each chunk is hashed with SHA256 for content-based deduplication—identical code in multiple files shares a single embedding.

## Scopes

The embedding index supports multiple isolated scopes:

### Main Scope

- One per project
- Indexes the main repository working directory
- Persists across sessions
- Updated incrementally on file changes

### Worktree Scopes

- One per active pulse/workflow
- Indexes an isolated git worktree
- Inherits unchanged files from main scope (avoids re-embedding)
- Automatically cleaned up when pulse ends
- Enables search over work-in-progress without polluting main index

## File Selection

### Supported Extensions

The indexer processes files with these extensions:

**Code:**
`.cs`, `.fs`, `.vb`, `.xaml`, `.axaml`, `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.rs`, `.go`, `.java`, `.kt`, `.c`, `.cpp`, `.h`, `.hpp`, `.rb`, `.php`, `.swift`, `.sql`

**Documentation:**
`.md`, `.txt`

**Configuration:**
`.json`, `.yaml`, `.yml`, `.xml`, `.html`, `.css`, `.sh`, `.bash`, `.zsh`, `.dockerfile`, `.toml`, `.ini`, `.cfg`

### Exclusions

Files are automatically skipped if they:

- Exceed 96 KB in size
- Match `.gitignore` or `.autarchignore` patterns
- Are lock files (`package-lock.json`, `yarn.lock`, `Cargo.lock`, etc.)
- Appear to be binary (>10% control characters or contain null bytes)

## Indexing Process

### Initial Index

1. Enumerate all indexable files respecting ignore rules
2. Pre-scan to identify files needing embedding (hash comparison)
3. For each changed file:
   - Chunk the content
   - Check which chunks already exist (deduplication)
   - Generate embeddings for new chunks only
   - Store chunk mappings and file index entry
4. Update scope timestamp

### Incremental Updates

On file change:
1. Compute new file hash
2. If unchanged, skip
3. Delete old chunk mappings
4. Re-chunk and embed only new content
5. Orphaned chunks are garbage collected when worktree scopes are deleted

### Progress Reporting

Main scope indexing emits progress messages every 500ms with:
- Files processed / total
- Bytes processed / total
- Current phase (Analyzing → Started → InProgress → Completed)

## Semantic Search

### Query Flow

1. Embed the query text using the same model
2. Retrieve all chunk content hashes in the target scope
3. Load embedding vectors for those chunks
4. Compute cosine similarity between query and each chunk
5. Return top-k results sorted by similarity score

### Search Results

Each result includes:
- **FilePath**: Relative path from scope root
- **StartLine / EndLine**: 1-based line numbers (inclusive)
- **Snippet**: The actual chunk text
- **Score**: Cosine similarity (0.0 to 1.0)

## Data Model

### EmbeddingChunk

Stored by content hash (SHA256) for deduplication:

```csharp
class EmbeddingChunk
{
    string ContentHash;      // Primary key
    string ChunkText;        // Original text
    float[] Embedding;       // 768-dimensional vector
    int TokenCount;
    DateTime ComputedAt;
}
```

### EmbeddingScope

Defines a searchable index boundary:

```csharp
class EmbeddingScope
{
    string Id;               // ULID
    EmbeddingScopeType Type; // Main or Worktree
    string RootPath;         // Absolute path
    string? OwnerId;         // Pulse ID for worktrees
    DateTime? LastIndexedAt;
}
```

### FileChunkMapping

Links files to their chunks within a scope:

```csharp
class FileChunkMapping
{
    string ScopeId;
    string FilePath;         // Relative path
    string ContentHash;      // References EmbeddingChunk
    int ChunkIndex;          // Order within file
    int StartLine;           // 1-based
    int EndLine;             // 1-based, inclusive
}
```

## Performance Considerations

### Memory

- Embeddings are loaded on-demand during search (not kept in memory)
- Batch embedding includes periodic GC hints after large batches
- ONNX session uses memory arena pooling for repeated inference

### CPU

- Inference uses 75% of available cores to leave headroom for UI
- 5ms delay between file indexing to prevent CPU starvation
- Every 10 embeddings in a batch yields to the scheduler

### Storage

- Chunks are deduplicated by content hash across all scopes
- Worktree scopes copy file index entries (not embeddings) from main scope
- Orphaned chunks are garbage collected on worktree deletion

## Interface

### IEmbeddingProvider

```csharp
interface IEmbeddingProvider
{
    int Dimensions { get; }
    int MaxTokens { get; }
    
    Task<float[]> EmbedAsync(string text, CancellationToken ct);
    Task<float[][]> EmbedBatchAsync(IReadOnlyList<string> texts, CancellationToken ct);
    int CountTokens(string text);
}
```

### Key Service Methods

```csharp
// Index main repository on project open
Task EnsureMainScopeIndexedAsync(Guid projectId, string projectPath, CancellationToken ct);

// Create worktree scope for pulse
Task CreateWorktreeScopeAsync(Guid projectId, string pulseId, string worktreePath, CancellationToken ct);

// Semantic search within a scope
Task<IReadOnlyList<SemanticSearchResult>> SearchAsync(
    Guid projectId, string scopeId, string query, int limit, CancellationToken ct);

// Update single file on change
Task UpdateFileAsync(Guid projectId, string scopeId, string filePath, CancellationToken ct);
```

## Future Considerations

- **Vector database**: Replace brute-force search with HNSW index for large codebases
- **Incremental re-embedding**: Track model version to re-embed on model upgrades
- **Hybrid search**: Combine semantic search with FTS for keyword+meaning queries
- **Code-aware chunking**: Use AST parsing for smarter chunk boundaries (functions, classes)

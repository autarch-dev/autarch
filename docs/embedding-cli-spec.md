# Embedding CLI Specification

A minimal Rust CLI tool for generating text embeddings, built with Candle.

## Purpose

Replace the `@xenova/transformers` JavaScript embedding worker with a standalone binary that:
- Works reliably in bundled Bun executables
- Has no runtime dependencies
- Is small (~10-15MB binary)
- Supports batch processing via stdin

## Requirements

### Functional
- Accept text input via stdin (one text per line, JSON-encoded strings)
- Output embeddings as JSON arrays to stdout (one per line)
- Support batch processing (multiple texts in one invocation)
- Use a code-optimized embedding model
- Produce 768-dimensional embeddings (to match existing database schema)

### Non-Functional
- Binary size < 20MB
- Cold start < 500ms (model loaded from disk)
- Throughput > 10 embeddings/second on CPU
- Cross-platform: linux-x64, darwin-arm64, darwin-x64, windows-x64

## CLI Interface

```bash
# One-shot test (loads model, processes one request, exits)
echo '{"id": 1, "text": "function hello() { return 42; }"}' | embed

# Output
{"id": 1, "embedding": [0.0234, -0.0891, 0.1203, ...]}
```

### Persistent Mode (Recommended)

The process stays alive, reading from stdin until it closes. Uses request IDs for multiplexing.

```bash
# Start the process (blocks, waiting for input)
embed --model-path ~/.autarch/models/jina.gguf
```

**Protocol (JSON Lines):**

Request format:
```json
{"id": 1, "text": "function hello() { return 42; }"}
{"id": 2, "text": "class Foo extends Bar {}"}
```

Response format:
```json
{"id": 1, "embedding": [0.0234, -0.0891, ...]}
{"id": 2, "embedding": [0.0567, -0.0123, ...]}
```

Error response:
```json
{"id": 3, "error": "Text exceeds maximum token limit"}
```

**Benefits:**
- Responses can arrive out-of-order (future batching/parallelism)
- Errors are tied to specific requests
- Client matches responses by ID, no order tracking needed
- Process exits when stdin closes (EOF)

### Arguments

```
embed [OPTIONS]

Options:
  --model-path <PATH>   Path to the model file (default: ~/.autarch/models/embed.gguf)
  --dimensions <N>      Output dimensions, truncate if model produces more (default: 768)
  --normalize           L2 normalize the output vectors (default: true)
  --help                Print help
  --version             Print version
```

## Model Selection

Use **jina-embeddings-v2-base-code** in GGUF format:
- Specifically optimized for code embeddings
- 768 dimensions (matches existing database schema)
- 8192 token context window
- Q8_0 quantized: ~260MB (best quality)
- Q4_K_M quantized: ~140MB (good quality/size tradeoff)

Download URL (from ggml-org, the llama.cpp maintainers):
```
https://huggingface.co/ggml-org/jina-embeddings-v2-base-code-Q8_0-GGUF/resolve/main/jina-embeddings-v2-base-code-q8_0.gguf
```

## Implementation Notes

### Candle Setup

```toml
# Cargo.toml
[package]
name = "embed"
version = "0.1.0"
edition = "2021"

[dependencies]
candle-core = "0.8"
candle-nn = "0.8"
candle-transformers = "0.8"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
anyhow = "1.0"
hf-hub = "0.3"  # For model downloading

[profile.release]
lto = true
codegen-units = 1
strip = true
panic = "abort"
```

### Architecture

```
src/
├── main.rs          # CLI entry point, argument parsing
├── model.rs         # Model loading and inference
└── tokenizer.rs     # Text tokenization (use candle's built-in or tokenizers crate)
```

### Key Implementation Points

1. **Model Loading**: Load GGUF file using candle's GGUF support
2. **Tokenization**: Use the model's tokenizer (usually included in GGUF or download separately)
3. **Batching**: Process multiple inputs efficiently by batching tokenized sequences
4. **Pooling**: Use mean pooling over token embeddings (standard for sentence embeddings)
5. **Normalization**: L2 normalize output vectors for cosine similarity

### Input Processing (Persistent Mode)

```rust
use std::io::{self, BufRead, Write};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct Request {
    id: u64,
    text: String,
}

#[derive(Serialize)]
#[serde(untagged)]
enum Response {
    Success { id: u64, embedding: Vec<f32> },
    Error { id: u64, error: String },
}

fn main() -> anyhow::Result<()> {
    // Load model once at startup
    let model = load_model(&args.model_path)?;
    
    // Signal ready (parent process waits for this)
    eprintln!("ready");
    
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    
    for line in stdin.lock().lines() {
        let line = line?;
        let request: Request = serde_json::from_str(&line)?;
        
        let response = match model.embed(&request.text) {
            Ok(embedding) => Response::Success {
                id: request.id,
                embedding: embedding.to_vec(),
            },
            Err(e) => Response::Error {
                id: request.id,
                error: e.to_string(),
            },
        };
        
        writeln!(stdout, "{}", serde_json::to_string(&response)?)?;
        stdout.flush()?;
    }
    
    Ok(())
}
```

**Key points:**
- Request/response multiplexed by `id`
- Load model once, process many requests
- Print "ready" to stderr so parent knows model is loaded
- Errors returned per-request, don't crash the process
- Flush stdout after each response
- Loop exits when stdin hits EOF

### Output Format

Each embedding is a JSON array of 768 floats:
```json
[0.023456, -0.089123, 0.120345, ...]
```

One embedding per line, corresponding to input order.

## Build & Distribution

### Build Commands

```bash
# Standard release build
cargo build --release

# Cross-compile for other platforms (using cross)
cross build --release --target x86_64-unknown-linux-gnu
cross build --release --target aarch64-apple-darwin
cross build --release --target x86_64-apple-darwin
cross build --release --target x86_64-pc-windows-gnu
```

### Binary Naming

```
embed-linux-x64
embed-darwin-arm64
embed-darwin-x64
embed-windows-x64.exe
```

### GitHub Release Assets

Publish pre-built binaries as GitHub release assets. The parent project (autarch-cli) will download the appropriate binary on first run.

## Integration with Autarch

The autarch-cli project will:

1. Check for binary at `~/.autarch/bin/embed` (or `embed.exe` on Windows)
2. If missing, download from GitHub releases
3. Check for model at `~/.autarch/models/jina-embeddings-v2-base-code-q8_0.gguf`
4. If missing, download from Hugging Face
5. Invoke the binary via stdin/stdout for embedding operations

### Example Integration (TypeScript)

```typescript
import { spawn, type ChildProcess } from 'child_process';
import { createInterface } from 'readline';

interface EmbedRequest {
  id: number;
  text: string;
}

interface EmbedResponse {
  id: number;
  embedding?: number[];
  error?: string;
}

class EmbeddingService {
  private proc: ChildProcess | null = null;
  private pending = new Map<number, {
    resolve: (embedding: Float32Array) => void;
    reject: (error: Error) => void;
  }>();
  private nextId = 0;

  async start(modelPath: string): Promise<void> {
    this.proc = spawn('~/.autarch/bin/embed', ['--model-path', modelPath]);
    
    const rl = createInterface({ input: this.proc.stdout! });
    rl.on('line', (line) => {
      const response: EmbedResponse = JSON.parse(line);
      const handler = this.pending.get(response.id);
      if (handler) {
        this.pending.delete(response.id);
        if (response.error) {
          handler.reject(new Error(response.error));
        } else {
          handler.resolve(new Float32Array(response.embedding!));
        }
      }
    });

    // Wait for "ready" signal on stderr
    await new Promise<void>((resolve) => {
      const errRl = createInterface({ input: this.proc!.stderr! });
      errRl.on('line', (line) => {
        if (line === 'ready') resolve();
      });
    });
  }

  embed(text: string): Promise<Float32Array> {
    if (!this.proc) throw new Error('Service not started');
    
    const id = ++this.nextId;
    const request: EmbedRequest = { id, text };
    
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc!.stdin!.write(JSON.stringify(request) + '\n');
    });
  }

  stop(): void {
    this.proc?.stdin?.end();
    this.proc = null;
  }
}

// Usage
const embedder = new EmbeddingService();
await embedder.start('~/.autarch/models/jina.gguf');

// Can fire multiple requests concurrently
const [vec1, vec2] = await Promise.all([
  embedder.embed('function hello() {}'),
  embedder.embed('class Foo {}'),
]);

embedder.stop();
```

## Testing

### Unit Tests
- Verify tokenization matches expected output
- Verify embedding dimensions (768)
- Verify L2 normalization (vectors should have magnitude ~1.0)

### Integration Tests
- Batch processing: 100 texts in one invocation
- Unicode handling: emoji, CJK characters, RTL text
- Long text handling: truncate gracefully at model's max length (typically 8192 tokens)

### Benchmarks
- Cold start time (first embedding)
- Throughput (embeddings per second)
- Memory usage

## Error Handling

**Per-request errors** (returned via stdout, process continues):
```json
{"id": 3, "error": "Text exceeds maximum token limit (8192)"}
{"id": 7, "error": "Invalid UTF-8 in input"}
```

**Fatal errors** (process exits):

Exit codes:
- 0: Clean shutdown (stdin closed)
- 1: Invalid arguments
- 2: Model file not found
- 3: Model loading failed

Fatal errors go to stderr before exit:
```
error: Model file not found: /home/user/.autarch/models/embed.gguf
```

## Future Considerations

- GPU acceleration (CUDA, Metal) - add as optional feature flags
- Server mode with HTTP API for persistent model loading
- Support for alternative models (different dimensions)

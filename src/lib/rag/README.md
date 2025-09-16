# DementiaFriend RAG System

A comprehensive Retrieval-Augmented Generation (RAG) system built for the DementiaFriend application, enabling semantic search and context-aware conversations through MongoDB Atlas Vector Search and BGE-M3 embeddings.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App  │───▶│  RAG Helper Lib  │───▶│ MongoDB Atlas   │
│   (Main App)    │    │                  │    │ Vector Search   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ Embedding Service│
                       │   (BGE-M3)       │
                       └──────────────────┘
```

## Core Components

### 1. Document Processing (`document-processor.ts`)
- **Text Chunking**: Splits large documents into manageable chunks
- **Smart Sentence Splitting**: Preserves sentence boundaries
- **Overlap Management**: Maintains context between chunks
- **Keyword Extraction**: Automatic tag generation
- **Summary Generation**: Creates document summaries

### 2. Vector Storage (`vector-store.ts`)
- **MongoDB Integration**: Seamless Atlas Vector Search integration
- **CRUD Operations**: Full document lifecycle management
- **Hybrid Search**: Combines vector and metadata filtering
- **Batch Operations**: Efficient bulk document processing
- **Index Management**: Vector search index configuration

### 3. Embedding Client (`embedding-client.ts`)
- **BGE-M3 Integration**: Connects to separate embedding service
- **Retry Logic**: Robust error handling and retries
- **Batch Processing**: Efficient embedding generation
- **Health Monitoring**: Service status validation
- **Connection Management**: Automatic service discovery

### 4. Semantic Search (`search.ts`)
- **Vector Similarity**: Cosine similarity search
- **Context Building**: RAG context generation for AI
- **Document Management**: Add, update, delete operations
- **Similar Document Discovery**: Find related content
- **Multi-user Support**: User-scoped document access

## Quick Start

### 1. Setup Environment

```bash
# Add to .env
EMBEDDING_SERVICE_URL=http://localhost:8080
MONGODB_URI=your_mongodb_atlas_uri
```

### 2. Start Embedding Service

```bash
cd ../dementiafriend-embedding-service
docker-compose up -d
```

### 3. Initialize RAG System

```typescript
import { initializeRAG } from '@/lib/rag';

await initializeRAG();
```

## Usage Examples

### Adding Documents

```typescript
import { addDocument } from '@/lib/rag';

const documentIds = await addDocument({
  userId: 'user@example.com',
  title: 'Family Memory',
  content: 'Today we visited the park...',
  contentType: 'memory',
  tags: ['family', 'outdoor']
});
```

### Semantic Search

```typescript
import { search } from '@/lib/rag';

const results = await search({
  query: 'family activities',
  filters: {
    userId: 'user@example.com',
    contentType: 'memory'
  },
  options: {
    limit: 5,
    threshold: 0.7
  }
});
```

### Building RAG Context

```typescript
import { buildContext } from '@/lib/rag';

const context = await buildContext(
  'What did we do at the park?',
  'user@example.com',
  'companion-123',
  5, // max documents
  4000 // max context length
);
```

## API Endpoints

### POST /api/rag/add-document
Add a new document to the knowledge base.

### POST /api/rag/search
Perform semantic search across documents.

### POST /api/rag/context
Build RAG context for AI conversations.

### GET /api/rag/documents
List user's documents with pagination.

### PUT /api/rag/documents/[id]
Update an existing document.

### DELETE /api/rag/documents/[id]
Remove a document from the knowledge base.

### GET /api/rag/similar/[id]
Find documents similar to a given document.

### GET /api/rag/health
Check RAG system health status.

## Document Types

| Type | Description | Use Case |
|------|-------------|----------|
| `memory` | Personal memories and experiences | Life stories, significant events |
| `note` | User-generated notes and reminders | Daily notes, important information |
| `conversation` | Chat history and interactions | Previous AI conversations |
| `document` | Uploaded files and external content | PDFs, articles, external documents |

## Configuration

### MongoDB Atlas Vector Search Index

Required index configuration:
```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1024,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "userId"
    },
    {
      "type": "filter",
      "path": "contentType"
    },
    {
      "type": "filter",
      "path": "companionId"
    }
  ]
}
```

### Chunking Options

```typescript
interface ChunkingOptions {
  maxChunkSize?: number;     // Default: 1000
  overlapSize?: number;      // Default: 200
  preserveSentences?: boolean; // Default: true
}
```

### Search Options

```typescript
interface SearchOptions {
  limit?: number;           // Default: 10
  threshold?: number;       // Default: 0.7
  includeMetadata?: boolean; // Default: false
  includeContent?: boolean;  // Default: true
}
```

## Error Handling

The system includes comprehensive error handling:

```typescript
import { RAGError } from '@/lib/rag/types';

try {
  await addDocument(params);
} catch (error) {
  if (error instanceof RAGError) {
    console.error(`RAG Error: ${error.code}`, error.message);
  }
}
```

Error codes:
- `EMBEDDING_SERVICE_ERROR`: Embedding service issues
- `DATABASE_ERROR`: MongoDB operation failures
- `VALIDATION_ERROR`: Input validation failures
- `NOT_FOUND`: Resource not found

## Performance Optimization

### Best Practices

1. **Batch Operations**: Use bulk insert for multiple documents
2. **Proper Chunking**: Balance chunk size and overlap for context
3. **Index Optimization**: Ensure proper vector search index configuration
4. **Caching**: Consider caching frequently accessed embeddings
5. **Connection Pooling**: MongoDB connection optimization

### Monitoring

```typescript
// Health check
const health = await healthCheck();

// User statistics
const stats = await getStats(userId);

// Service validation
const isHealthy = await validateEmbeddingService();
```

## Integration with AI Conversations

```typescript
// In your AI chat endpoint
import { buildContext } from '@/lib/rag';

const context = await buildContext(
  userMessage,
  session.user.email,
  companionId
);

const systemPrompt = `
You are a helpful companion. Use the following context to inform your responses:

${context.relevantDocuments.map(doc =>
  `[${doc.document.title}]: ${doc.document.content}`
).join('\n\n')}

User question: ${userMessage}
`;
```

## Troubleshooting

### Common Issues

1. **Embedding Service Not Available**
   - Check service status: `GET /api/rag/health`
   - Verify EMBEDDING_SERVICE_URL environment variable
   - Ensure embedding service is running

2. **Vector Search Not Working**
   - Verify MongoDB Atlas Vector Search index is created
   - Check index configuration matches requirements
   - Ensure proper Atlas cluster tier (M10+)

3. **Poor Search Results**
   - Adjust similarity threshold
   - Verify document content quality
   - Check embedding model performance

### Debug Mode

Enable debug logging:
```typescript
// Set LOG_LEVEL=debug in environment
// Check embedding service logs
// Monitor MongoDB Atlas metrics
```

## Future Enhancements

- **Multi-modal Search**: Support for image and audio embeddings
- **Advanced Chunking**: Semantic chunking based on content structure
- **Caching Layer**: Redis-based embedding cache
- **Analytics**: Search quality metrics and user behavior tracking
- **A/B Testing**: Different embedding models and search strategies
import { ObjectId } from 'mongodb';

export interface DocumentMetadata {
  createdAt: Date;
  updatedAt: Date;
  source?: string;
  tags?: string[];
  summary?: string;
}

export type ContentType = 'memory' | 'note' | 'conversation' | 'document';

export interface DocumentRecord {
  _id?: ObjectId;
  userId: string;
  companionId?: string;
  title: string;
  content: string;
  contentType: ContentType;
  metadata: DocumentMetadata;
  embedding: number[];
  chunkId?: string;
  chunkIndex?: number;
}

export interface DocumentChunk {
  text: string;
  chunkId: string;
  chunkIndex: number;
  metadata: {
    title: string;
    contentType: ContentType;
    source?: string;
  };
}

export interface EmbeddingRequest {
  texts: string[];
  model?: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage: {
    total_tokens: number;
  };
}

export interface EmbeddingServiceHealth {
  status: 'healthy' | 'unhealthy';
  model: string;
  version: string;
  uptime: number;
}

export interface SearchFilters {
  userId: string;
  companionId?: string;
  contentType?: ContentType | ContentType[];
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  includeMetadata?: boolean;
  includeContent?: boolean;
}

export interface SearchResult {
  document: DocumentRecord;
  score: number;
  highlights?: string[];
}

export interface SemanticSearchParams {
  query: string;
  filters: SearchFilters;
  options?: SearchOptions;
}

export interface SemanticSearchResponse {
  results: SearchResult[];
  totalCount: number;
  queryEmbedding?: number[];
}

export interface AddDocumentParams {
  userId: string;
  companionId?: string;
  title: string;
  content: string;
  contentType: ContentType;
  source?: string;
  tags?: string[];
}

export interface UpdateDocumentParams {
  documentId: string;
  title?: string;
  content?: string;
  tags?: string[];
  summary?: string;
}

export interface ChunkingOptions {
  maxChunkSize?: number;
  overlapSize?: number;
  preserveSentences?: boolean;
}

export interface RAGContext {
  relevantDocuments: SearchResult[];
  query: string;
  maxContextLength?: number;
}

export interface RAGResponse {
  answer: string;
  sources: SearchResult[];
  confidence: number;
}

export class RAGError extends Error {
  constructor(
    message: string,
    public code: 'EMBEDDING_SERVICE_ERROR' | 'DATABASE_ERROR' | 'VALIDATION_ERROR' | 'NOT_FOUND',
    public details?: any
  ) {
    super(message);
    this.name = 'RAGError';
  }
}
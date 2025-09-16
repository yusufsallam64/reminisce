// Export all types
export * from './types';

// Export main classes
export { EmbeddingClient, embeddingClient } from './embedding-client';
export { VectorStore } from './vector-store';
export { DocumentProcessor } from './document-processor';
export { SemanticSearchEngine, semanticSearch } from './search';

// Export convenience functions
import { semanticSearch } from './search';
import { embeddingClient } from './embedding-client';
import {
  AddDocumentParams,
  SemanticSearchParams,
  SemanticSearchResponse,
  RAGContext,
  UpdateDocumentParams,
  DocumentRecord
} from './types';

/**
 * Add a document to the knowledge base
 */
export const addDocument = async (params: AddDocumentParams): Promise<string[]> => {
  return semanticSearch.addDocument(params);
};

/**
 * Perform semantic search
 */
export const search = async (params: SemanticSearchParams): Promise<SemanticSearchResponse> => {
  return semanticSearch.semanticSearch(params);
};

/**
 * Build RAG context for AI conversations
 */
export const buildContext = async (
  query: string,
  userId: string,
  companionId?: string,
  maxDocuments?: number,
  maxContextLength?: number
): Promise<RAGContext> => {
  return semanticSearch.buildRAGContext(
    query,
    userId,
    companionId,
    maxDocuments,
    maxContextLength
  );
};

/**
 * Update an existing document
 */
export const updateDocument = async (params: UpdateDocumentParams): Promise<void> => {
  return semanticSearch.updateDocument(params);
};

/**
 * Delete a document
 */
export const deleteDocument = async (documentId: string): Promise<void> => {
  return semanticSearch.deleteDocument(documentId);
};

/**
 * Get user's documents
 */
export const getUserDocuments = async (
  userId: string,
  contentType?: string,
  limit?: number,
  skip?: number
) => {
  return semanticSearch.getUserDocuments(userId, contentType, limit, skip);
};

/**
 * Find similar documents
 */
export const findSimilarDocuments = async (
  documentId: string,
  limit?: number
): Promise<SemanticSearchResponse> => {
  return semanticSearch.searchSimilarDocuments(documentId, limit);
};

/**
 * Search by tags
 */
export const searchByTags = async (
  tags: string[],
  userId: string,
  companionId?: string,
  limit?: number
): Promise<DocumentRecord[]> => {
  return semanticSearch.searchByTags(tags, userId, companionId, limit);
};

/**
 * Get recent documents
 */
export const getRecentDocuments = async (
  userId: string,
  companionId?: string,
  days?: number,
  limit?: number
): Promise<DocumentRecord[]> => {
  return semanticSearch.getRecentDocuments(userId, companionId, days, limit);
};

/**
 * Hybrid search (semantic + text)
 */
export const hybridSearch = async (
  semanticQuery: string,
  textQuery: string,
  params: SemanticSearchParams
): Promise<SemanticSearchResponse> => {
  return semanticSearch.hybridSearch(semanticQuery, textQuery, params);
};

/**
 * Validate embedding service connection
 */
export const validateEmbeddingService = async (): Promise<boolean> => {
  return semanticSearch.validateEmbeddingService();
};

/**
 * Get RAG system statistics
 */
export const getStats = async (userId: string) => {
  return semanticSearch.getStats(userId);
};

/**
 * Health check for the entire RAG system
 */
export const healthCheck = async () => {
  try {
    const embeddingServiceHealthy = await embeddingClient.validateConnection();
    const embeddingServiceHealth = embeddingServiceHealthy
      ? await embeddingClient.getHealth()
      : null;

    return {
      status: embeddingServiceHealthy ? 'healthy' : 'unhealthy',
      embeddingService: {
        healthy: embeddingServiceHealthy,
        details: embeddingServiceHealth
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Initialize the RAG system
 */
export const initializeRAG = async () => {
  try {
    // Validate embedding service
    await embeddingClient.waitForService(30000);

    // Create vector search index (if needed)
    // Note: This typically needs to be done via Atlas UI in production
    await semanticSearch.createVectorSearchIndex();

    return { initialized: true };
  } catch (error) {
    throw new Error(`Failed to initialize RAG system: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
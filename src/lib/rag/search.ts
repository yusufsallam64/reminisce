import {
  SemanticSearchParams,
  SemanticSearchResponse,
  AddDocumentParams,
  UpdateDocumentParams,
  DocumentRecord,
  DocumentChunk,
  RAGContext,
  RAGResponse,
  RAGError,
  ChunkingOptions
} from './types';
import { VectorStore } from './vector-store';
import { embeddingClient } from './embedding-client';
import { DocumentProcessor } from './document-processor';

export class SemanticSearchEngine {
  private vectorStore: VectorStore;

  constructor(databaseName?: string) {
    this.vectorStore = new VectorStore(databaseName);
  }

  async addDocument(params: AddDocumentParams): Promise<string[]> {
    try {
      // Validate input
      if (!params.content.trim()) {
        throw new RAGError('Document content cannot be empty', 'VALIDATION_ERROR');
      }

      if (!params.userId) {
        throw new RAGError('User ID is required', 'VALIDATION_ERROR');
      }

      // Process and chunk the document
      const chunks = DocumentProcessor.chunkDocument(
        params.content,
        params.title,
        params.contentType,
        { maxChunkSize: 1000, overlapSize: 200 },
        params.source
      );

      // Generate embeddings for all chunks
      const texts = chunks.map(chunk => chunk.text);
      const embeddingResponse = await embeddingClient.embedTexts(texts);

      // Create document records
      const documentRecords: Omit<DocumentRecord, '_id'>[] = chunks.map((chunk, index) => ({
        userId: params.userId,
        companionId: params.companionId,
        title: params.title,
        content: chunk.text,
        contentType: params.contentType,
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          source: params.source,
          tags: params.tags,
          summary: index === 0 ? DocumentProcessor.generateSummary(params.content) : undefined
        },
        embedding: embeddingResponse.embeddings[index],
        chunkId: chunk.chunkId,
        chunkIndex: chunk.chunkIndex
      }));

      // Store in vector database
      const documentIds = await this.vectorStore.insertDocuments(documentRecords);

      return documentIds;
    } catch (error) {
      if (error instanceof RAGError) throw error;
      throw new RAGError(
        'Failed to add document',
        'DATABASE_ERROR',
        { originalError: error }
      );
    }
  }

  async updateDocument(params: UpdateDocumentParams): Promise<void> {
    try {
      const document = await this.vectorStore.getDocument(params.documentId);
      if (!document) {
        throw new RAGError('Document not found', 'NOT_FOUND');
      }

      // If content is being updated, we need to regenerate embeddings
      if (params.content) {
        const embedding = await embeddingClient.embedSingle(params.content);
        await this.vectorStore.updateDocument({
          ...params,
          content: params.content
        });

        // Update the embedding in the database
        // Note: This is a simplified approach. In production, you might want to
        // handle this as a separate method that updates the embedding field
      } else {
        await this.vectorStore.updateDocument(params);
      }
    } catch (error) {
      if (error instanceof RAGError) throw error;
      throw new RAGError(
        'Failed to update document',
        'DATABASE_ERROR',
        { originalError: error }
      );
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    return this.vectorStore.deleteDocument(documentId);
  }

  async semanticSearch(params: SemanticSearchParams): Promise<SemanticSearchResponse> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await embeddingClient.embedSingle(params.query);

      // Perform vector search
      const results = await this.vectorStore.vectorSearch(
        queryEmbedding,
        params.filters,
        params.options
      );

      // Get total count for pagination
      const { total } = await this.vectorStore.listDocuments(
        params.filters,
        1,
        0
      );

      return {
        results,
        totalCount: total,
        queryEmbedding: params.options?.includeMetadata ? queryEmbedding : undefined
      };
    } catch (error) {
      if (error instanceof RAGError) throw error;
      throw new RAGError(
        'Semantic search failed',
        'DATABASE_ERROR',
        { originalError: error }
      );
    }
  }

  async hybridSearch(
    query: string,
    textQuery: string,
    params: SemanticSearchParams
  ): Promise<SemanticSearchResponse> {
    try {
      // Generate embedding for the semantic query
      const queryEmbedding = await embeddingClient.embedSingle(query);

      // Perform hybrid search (vector + text)
      const results = await this.vectorStore.hybridSearch(
        queryEmbedding,
        textQuery,
        params.filters,
        params.options
      );

      return {
        results,
        totalCount: results.length,
        queryEmbedding: params.options?.includeMetadata ? queryEmbedding : undefined
      };
    } catch (error) {
      if (error instanceof RAGError) throw error;
      throw new RAGError(
        'Hybrid search failed',
        'DATABASE_ERROR',
        { originalError: error }
      );
    }
  }

  async buildRAGContext(
    query: string,
    userId: string,
    companionId?: string,
    maxDocuments: number = 5,
    maxContextLength: number = 4000
  ): Promise<RAGContext> {
    try {
      const searchParams: SemanticSearchParams = {
        query,
        filters: { userId, companionId },
        options: {
          limit: maxDocuments,
          threshold: 0.7,
          includeContent: true
        }
      };

      const searchResponse = await this.semanticSearch(searchParams);

      // Truncate context if it's too long
      let totalLength = 0;
      const relevantDocuments = [];

      for (const result of searchResponse.results) {
        const contentLength = result.document.content.length;
        if (totalLength + contentLength <= maxContextLength) {
          relevantDocuments.push(result);
          totalLength += contentLength;
        } else {
          // Truncate the last document to fit
          const remainingLength = maxContextLength - totalLength;
          if (remainingLength > 100) { // Only include if we have reasonable space
            const truncatedContent = result.document.content.slice(0, remainingLength);
            relevantDocuments.push({
              ...result,
              document: {
                ...result.document,
                content: truncatedContent + '...'
              }
            });
          }
          break;
        }
      }

      return {
        relevantDocuments,
        query,
        maxContextLength
      };
    } catch (error) {
      if (error instanceof RAGError) throw error;
      throw new RAGError(
        'Failed to build RAG context',
        'DATABASE_ERROR',
        { originalError: error }
      );
    }
  }

  async searchSimilarDocuments(
    documentId: string,
    limit: number = 5
  ): Promise<SemanticSearchResponse> {
    try {
      // Get the reference document
      const document = await this.vectorStore.getDocument(documentId);
      if (!document) {
        throw new RAGError('Reference document not found', 'NOT_FOUND');
      }

      // Use the document's embedding to find similar documents
      const results = await this.vectorStore.vectorSearch(
        document.embedding,
        { userId: document.userId, companionId: document.companionId },
        { limit: limit + 1, threshold: 0.5 } // +1 to exclude the original document
      );

      // Filter out the original document
      const filteredResults = results.filter(
        result => result.document._id?.toString() !== documentId
      );

      return {
        results: filteredResults.slice(0, limit),
        totalCount: filteredResults.length
      };
    } catch (error) {
      if (error instanceof RAGError) throw error;
      throw new RAGError(
        'Failed to find similar documents',
        'DATABASE_ERROR',
        { originalError: error }
      );
    }
  }

  async getUserDocuments(
    userId: string,
    contentType?: string,
    limit: number = 50,
    skip: number = 0
  ) {
    const filters: any = { userId };
    if (contentType) filters.contentType = contentType;

    return this.vectorStore.listDocuments(filters, limit, skip);
  }

  async deleteUserDocuments(userId: string): Promise<number> {
    return this.vectorStore.deleteDocumentsByUser(userId);
  }

  async getDocumentById(documentId: string): Promise<DocumentRecord | null> {
    return this.vectorStore.getDocument(documentId);
  }

  async searchByTags(
    tags: string[],
    userId: string,
    companionId?: string,
    limit: number = 20
  ): Promise<DocumentRecord[]> {
    const { documents } = await this.vectorStore.listDocuments(
      { userId, companionId, tags },
      limit
    );
    return documents;
  }

  async getRecentDocuments(
    userId: string,
    companionId?: string,
    days: number = 7,
    limit: number = 10
  ): Promise<DocumentRecord[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { documents } = await this.vectorStore.listDocuments(
      {
        userId,
        companionId,
        dateRange: { start: startDate, end: new Date() }
      },
      limit
    );
    return documents;
  }

  async getStats(userId: string) {
    const { total } = await this.vectorStore.listDocuments({ userId }, 1);
    const collectionStats = await this.vectorStore.getCollectionStats();

    return {
      userDocuments: total,
      ...collectionStats
    };
  }

  async validateEmbeddingService(): Promise<boolean> {
    return embeddingClient.validateConnection();
  }

  async createVectorSearchIndex(): Promise<void> {
    return this.vectorStore.createVectorSearchIndex();
  }
}

// Default singleton instance
export const semanticSearch = new SemanticSearchEngine();
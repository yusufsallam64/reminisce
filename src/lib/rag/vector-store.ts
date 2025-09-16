import { Collection, Db, ObjectId } from 'mongodb';
import client from '@/lib/db/client';
import {
  DocumentRecord,
  SearchFilters,
  SearchOptions,
  SearchResult,
  UpdateDocumentParams,
  RAGError
} from './types';

export class VectorStore {
  private db: Db;
  private collection: Collection<DocumentRecord>;
  private indexName = 'vector_search_index';

  constructor(databaseName: string = 'dementiafriend-rag') {
    this.db = client.db(databaseName);
    this.collection = this.db.collection<DocumentRecord>('documents');
  }

  async ensureConnection(): Promise<void> {
    try {
      await client.connect();
      await this.db.admin().ping();
    } catch (error) {
      throw new RAGError(
        'Failed to connect to MongoDB',
        'DATABASE_ERROR',
        { originalError: error }
      );
    }
  }

  async insertDocument(document: Omit<DocumentRecord, '_id'>): Promise<string> {
    try {
      await this.ensureConnection();

      const result = await this.collection.insertOne({
        ...document,
        metadata: {
          ...document.metadata,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      return result.insertedId.toString();
    } catch (error) {
      throw new RAGError(
        'Failed to insert document',
        'DATABASE_ERROR',
        { originalError: error }
      );
    }
  }

  async insertDocuments(documents: Omit<DocumentRecord, '_id'>[]): Promise<string[]> {
    try {
      await this.ensureConnection();

      const documentsWithTimestamps = documents.map(doc => ({
        ...doc,
        metadata: {
          ...doc.metadata,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }));

      const result = await this.collection.insertMany(documentsWithTimestamps);
      return Object.values(result.insertedIds).map(id => id.toString());
    } catch (error) {
      throw new RAGError(
        'Failed to insert documents',
        'DATABASE_ERROR',
        { originalError: error }
      );
    }
  }

  async updateDocument(params: UpdateDocumentParams): Promise<void> {
    try {
      await this.ensureConnection();

      const updateDoc: any = {
        'metadata.updatedAt': new Date()
      };

      if (params.title) updateDoc.title = params.title;
      if (params.content) updateDoc.content = params.content;
      if (params.tags) updateDoc['metadata.tags'] = params.tags;
      if (params.summary) updateDoc['metadata.summary'] = params.summary;

      const result = await this.collection.updateOne(
        { _id: new ObjectId(params.documentId) },
        { $set: updateDoc }
      );

      if (result.matchedCount === 0) {
        throw new RAGError('Document not found', 'NOT_FOUND');
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
    try {
      await this.ensureConnection();

      const result = await this.collection.deleteOne({
        _id: new ObjectId(documentId)
      });

      if (result.deletedCount === 0) {
        throw new RAGError('Document not found', 'NOT_FOUND');
      }
    } catch (error) {
      if (error instanceof RAGError) throw error;
      throw new RAGError(
        'Failed to delete document',
        'DATABASE_ERROR',
        { originalError: error }
      );
    }
  }

  async deleteDocumentsByUser(userId: string): Promise<number> {
    try {
      await this.ensureConnection();

      const result = await this.collection.deleteMany({ userId });
      return result.deletedCount;
    } catch (error) {
      throw new RAGError(
        'Failed to delete user documents',
        'DATABASE_ERROR',
        { originalError: error }
      );
    }
  }

  async getDocument(documentId: string): Promise<DocumentRecord | null> {
    try {
      await this.ensureConnection();

      const document = await this.collection.findOne({
        _id: new ObjectId(documentId)
      });

      return document;
    } catch (error) {
      throw new RAGError(
        'Failed to get document',
        'DATABASE_ERROR',
        { originalError: error }
      );
    }
  }

  async listDocuments(
    filters: Partial<SearchFilters>,
    limit: number = 50,
    skip: number = 0
  ): Promise<{ documents: DocumentRecord[]; total: number }> {
    try {
      await this.ensureConnection();

      const query = this.buildFilterQuery(filters);

      const [documents, total] = await Promise.all([
        this.collection
          .find(query)
          .sort({ 'metadata.updatedAt': -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        this.collection.countDocuments(query)
      ]);

      return { documents, total };
    } catch (error) {
      throw new RAGError(
        'Failed to list documents',
        'DATABASE_ERROR',
        { originalError: error }
      );
    }
  }

  async vectorSearch(
    queryEmbedding: number[],
    filters: SearchFilters,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
      await this.ensureConnection();

      const {
        limit = 10,
        threshold = 0.7,
        includeContent = true
      } = options;

      const pipeline: any[] = [
        {
          $vectorSearch: {
            index: this.indexName,
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: Math.max(limit * 10, 100),
            limit: limit,
            filter: this.buildFilterQuery(filters)
          }
        },
        {
          $addFields: {
            score: { $meta: 'vectorSearchScore' }
          }
        }
      ];

      // Filter by score threshold
      if (threshold > 0) {
        pipeline.push({
          $match: {
            score: { $gte: threshold }
          }
        });
      }

      // Project fields based on options
      if (!includeContent) {
        pipeline.push({
          $project: {
            content: 0,
            embedding: 0
          }
        });
      } else {
        pipeline.push({
          $project: {
            embedding: 0 // Always exclude embedding from results for size
          }
        });
      }

      const results = await this.collection.aggregate(pipeline).toArray();

      return results.map(doc => ({
        document: doc as DocumentRecord,
        score: doc.score,
        highlights: this.generateHighlights(doc.content, 3)
      }));
    } catch (error) {
      throw new RAGError(
        'Vector search failed',
        'DATABASE_ERROR',
        { originalError: error }
      );
    }
  }

  async hybridSearch(
    queryEmbedding: number[],
    textQuery: string,
    filters: SearchFilters,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
      // Get vector search results
      const vectorResults = await this.vectorSearch(queryEmbedding, filters, {
        ...options,
        limit: (options.limit || 10) * 2 // Get more candidates for reranking
      });

      // If no text query, return vector results
      if (!textQuery.trim()) {
        return vectorResults.slice(0, options.limit || 10);
      }

      // Score results based on text match
      const textTerms = textQuery.toLowerCase().split(/\s+/);
      const hybridResults = vectorResults.map(result => {
        const content = result.document.content.toLowerCase();
        const title = result.document.title.toLowerCase();

        let textScore = 0;
        textTerms.forEach(term => {
          if (content.includes(term)) textScore += 1;
          if (title.includes(term)) textScore += 2; // Title matches weighted higher
        });

        // Combine vector score and text score
        const hybridScore = (result.score * 0.7) + (textScore * 0.3);

        return {
          ...result,
          score: hybridScore
        };
      });

      // Sort by hybrid score and return top results
      return hybridResults
        .sort((a, b) => b.score - a.score)
        .slice(0, options.limit || 10);
    } catch (error) {
      throw new RAGError(
        'Hybrid search failed',
        'DATABASE_ERROR',
        { originalError: error }
      );
    }
  }

  private buildFilterQuery(filters: Partial<SearchFilters>): any {
    const query: any = {};

    if (filters.userId) {
      query.userId = filters.userId;
    }

    if (filters.companionId) {
      query.companionId = filters.companionId;
    }

    if (filters.contentType) {
      if (Array.isArray(filters.contentType)) {
        query.contentType = { $in: filters.contentType };
      } else {
        query.contentType = filters.contentType;
      }
    }

    if (filters.tags && filters.tags.length > 0) {
      query['metadata.tags'] = { $in: filters.tags };
    }

    if (filters.dateRange) {
      query['metadata.createdAt'] = {
        $gte: filters.dateRange.start,
        $lte: filters.dateRange.end
      };
    }

    return query;
  }

  private generateHighlights(content: string, maxHighlights: number = 3): string[] {
    if (!content) return [];

    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences
      .slice(0, maxHighlights)
      .map(s => s.trim() + '...');
  }

  async createVectorSearchIndex(): Promise<void> {
    try {
      await this.ensureConnection();

      const indexDefinition = {
        name: this.indexName,
        type: 'vectorSearch',
        definition: {
          fields: [
            {
              type: 'vector',
              path: 'embedding',
              numDimensions: 1024, // BGE-M3 embedding dimension
              similarity: 'cosine'
            },
            {
              type: 'filter',
              path: 'userId'
            },
            {
              type: 'filter',
              path: 'contentType'
            },
            {
              type: 'filter',
              path: 'companionId'
            },
            {
              type: 'filter',
              path: 'metadata.tags'
            }
          ]
        }
      };

      // Note: Vector search index creation in Atlas is typically done via Atlas UI or Atlas Admin API
      // This is a placeholder for documentation purposes
      console.log('Vector search index definition:', JSON.stringify(indexDefinition, null, 2));
      console.log('Please create this index in MongoDB Atlas Vector Search');
    } catch (error) {
      throw new RAGError(
        'Failed to create vector search index',
        'DATABASE_ERROR',
        { originalError: error }
      );
    }
  }

  async getCollectionStats(): Promise<any> {
    try {
      await this.ensureConnection();

      const stats = await this.db.command({ collStats: 'documents' });
      return {
        documentCount: stats.count,
        storageSize: stats.storageSize,
        avgDocumentSize: stats.avgObjSize
      };
    } catch (error) {
      throw new RAGError(
        'Failed to get collection stats',
        'DATABASE_ERROR',
        { originalError: error }
      );
    }
  }
}
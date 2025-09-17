import client from '@/lib/db/client';

export interface SearchResult {
  content: string;
  title: string;
  score: number;
  metadata: {
    originalFilename: string;
    chunkIndex: number;
    totalChunks: number;
    summary: string;
  };
}

export interface VectorSearchOptions {
  limit?: number;
  numCandidates?: number;
}

/**
 * Search for similar documents using vector embeddings
 * @param query - The search query text
 * @param userId - User ID to filter results
 * @param companionId - Companion ID to filter results
 * @param options - Search options (limit, numCandidates)
 * @returns Array of relevant document chunks
 */
export async function vectorSearch(
  query: string,
  userId: string,
  companionId: string,
  options: VectorSearchOptions = {}
): Promise<SearchResult[]> {
  const { limit = 3, numCandidates = 20 } = options;

  try {
    // Step 1: Get embedding for the query from Python service
    const ragServiceUrl = process.env.PYTHON_RAG_SERVICE_URL || 'http://localhost:8080';

    const embeddingResponse = await fetch(`${ragServiceUrl}/embed-query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query
      })
    });

    if (!embeddingResponse.ok) {
      throw new Error(`Failed to get embedding: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryVector = embeddingData.embedding;

    // Step 2: Connect to MongoDB and perform vector search
    await client.connect();
    const db = client.db('dementiafriend-rag');
    const collection = db.collection('documents');

    // Step 3: MongoDB vector search aggregation
    const searchResults = await collection.aggregate([
      {
        $vectorSearch: {
          index: "vector_search_index",
          path: "embedding",
          queryVector: queryVector,
          numCandidates: numCandidates,
          limit: limit,
          filter: {
            userId: userId,
            companionId: companionId
          }
        }
      },
      {
        $project: {
          content: 1,
          title: 1,
          metadata: 1,
          score: { $meta: "vectorSearchScore" }
        }
      }
    ]).toArray();

    // Step 4: Format results
    const formattedResults: SearchResult[] = searchResults.map(doc => ({
      content: doc.content,
      title: doc.title || 'Document',
      score: doc.score || 0,
      metadata: {
        originalFilename: doc.metadata?.originalFilename || 'Unknown',
        chunkIndex: doc.metadata?.chunkIndex || 0,
        totalChunks: doc.metadata?.totalChunks || 1,
        summary: doc.metadata?.summary || doc.content.substring(0, 100) + '...'
      }
    }));

    console.log(`Vector search found ${formattedResults.length} results for query: "${query}"`);

    return formattedResults;

  } catch (error) {
    console.error('Vector search error:', error);
    throw new Error(`Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (process.env.NODE_ENV !== 'development') {
      await client.close();
    }
  }
}
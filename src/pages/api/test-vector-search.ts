import type { NextApiRequest, NextApiResponse } from 'next';
import { vectorSearch } from '@/lib/rag/search';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Hardcoded test values
  const query = "EMMETT TILL and I";
  const userId = "safakaragoz74@gmail.com";
  const companionId = "68ca4a97d35124e535fbac59";
  const limit = 8;

  try {
    const results = await vectorSearch(query, userId, companionId, {
      limit: limit
    });

    return res.status(200).json({
      success: true,
      query: query,
      totalResults: results.length,
      results: results
    });

  } catch (error) {
    console.error('Vector search test error:', error);
    return res.status(500).json({
      success: false,
      error: 'Vector search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
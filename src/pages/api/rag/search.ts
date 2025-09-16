import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { search, hybridSearch } from '@/lib/rag';
import { SemanticSearchParams, ContentType } from '@/lib/rag/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      query,
      textQuery,
      companionId,
      contentType,
      tags,
      limit = 10,
      threshold = 0.7,
      includeContent = true,
      searchType = 'semantic'
    }: {
      query: string;
      textQuery?: string;
      companionId?: string;
      contentType?: ContentType | ContentType[];
      tags?: string[];
      limit?: number;
      threshold?: number;
      includeContent?: boolean;
      searchType?: 'semantic' | 'hybrid';
    } = req.body;

    // Validate required fields
    if (!query) {
      return res.status(400).json({
        error: 'Query is required'
      });
    }

    const searchParams: SemanticSearchParams = {
      query,
      filters: {
        userId: session.user.email,
        companionId,
        contentType,
        tags
      },
      options: {
        limit,
        threshold,
        includeContent
      }
    };

    let results;
    if (searchType === 'hybrid' && textQuery) {
      results = await hybridSearch(query, textQuery, searchParams);
    } else {
      results = await search(searchParams);
    }

    res.status(200).json({
      success: true,
      ...results
    });
  } catch (error) {
    console.error('Error performing search:', error);
    res.status(500).json({
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
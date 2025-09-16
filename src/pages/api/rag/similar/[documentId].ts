import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { findSimilarDocuments } from '@/lib/rag';
import { semanticSearch } from '@/lib/rag';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { documentId } = req.query;
    const { limit = '5' } = req.query;

    if (!documentId || typeof documentId !== 'string') {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    // Verify document exists and user owns it
    const document = await semanticSearch.getDocumentById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (document.userId !== session.user.email) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const results = await findSimilarDocuments(
      documentId,
      parseInt(limit as string, 10)
    );

    res.status(200).json({
      success: true,
      ...results
    });
  } catch (error) {
    console.error('Error finding similar documents:', error);
    res.status(500).json({
      error: 'Failed to find similar documents',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
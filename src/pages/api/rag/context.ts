import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { buildContext } from '@/lib/rag';

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
      companionId,
      maxDocuments = 5,
      maxContextLength = 4000
    }: {
      query: string;
      companionId?: string;
      maxDocuments?: number;
      maxContextLength?: number;
    } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Query is required'
      });
    }

    const context = await buildContext(
      query,
      session.user.email,
      companionId,
      maxDocuments,
      maxContextLength
    );

    res.status(200).json({
      success: true,
      context
    });
  } catch (error) {
    console.error('Error building context:', error);
    res.status(500).json({
      error: 'Failed to build context',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
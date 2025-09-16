import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { getUserDocuments } from '@/lib/rag';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'GET') {
      const {
        contentType,
        limit = '50',
        skip = '0'
      } = req.query;

      const result = await getUserDocuments(
        session.user.email,
        contentType as string,
        parseInt(limit as string, 10),
        parseInt(skip as string, 10)
      );

      return res.status(200).json({
        success: true,
        ...result
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      error: 'Failed to fetch documents',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
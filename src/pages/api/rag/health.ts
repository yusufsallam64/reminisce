import { NextApiRequest, NextApiResponse } from 'next';
import { healthCheck, getStats } from '@/lib/rag';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Health check doesn't require authentication, but stats do
    const session = await getServerSession(req, res, authOptions);
    const includeStats = session?.user?.email ? true : false;

    const health = await healthCheck();
    let stats = null;

    if (includeStats) {
      try {
        stats = await getStats(session.user.email);
      } catch (error) {
        console.warn('Failed to get user stats:', error);
      }
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      ...health,
      ...(stats && { userStats: stats })
    });
  } catch (error) {
    console.error('Error checking RAG health:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
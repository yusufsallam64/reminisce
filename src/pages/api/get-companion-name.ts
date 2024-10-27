import type { NextApiRequest, NextApiResponse } from 'next';
import client from '@/lib/db/client';

type Data = {
  companionName: string | null;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ companionName: null, error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ companionName: null, error: 'userId is required' });
    }

    await client.connect();
    const db = client.db('DB');
    
    const companion = await db.collection('Companions').findOne({ userId });

    if (!companion) {
      return res.status(404).json({ companionName: null, error: 'Companion not found' });
    }

    return res.status(200).json({ companionName: companion.companionName });
  } catch (error) {
    console.error('Error fetching companion name:', error);
    return res.status(500).json({ companionName: null, error: 'Internal server error' });
  } finally {
    if (process.env.NODE_ENV !== 'development') {
      await client.close();
    }
  }
}
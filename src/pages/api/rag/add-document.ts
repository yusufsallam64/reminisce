import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { addDocument } from '@/lib/rag';
import { AddDocumentParams, ContentType } from '@/lib/rag/types';

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
      title,
      content,
      contentType,
      companionId,
      source,
      tags
    }: {
      title: string;
      content: string;
      contentType: ContentType;
      companionId?: string;
      source?: string;
      tags?: string[];
    } = req.body;

    // Validate required fields
    if (!title || !content || !contentType) {
      return res.status(400).json({
        error: 'Missing required fields: title, content, contentType'
      });
    }

    // Validate content type
    const validContentTypes: ContentType[] = ['memory', 'note', 'conversation', 'document'];
    if (!validContentTypes.includes(contentType)) {
      return res.status(400).json({
        error: `Invalid content type. Must be one of: ${validContentTypes.join(', ')}`
      });
    }

    const params: AddDocumentParams = {
      userId: session.user.email,
      companionId,
      title,
      content,
      contentType,
      source,
      tags
    };

    const documentIds = await addDocument(params);

    res.status(201).json({
      success: true,
      documentIds,
      message: `Document added successfully with ${documentIds.length} chunks`
    });
  } catch (error) {
    console.error('Error adding document:', error);
    res.status(500).json({
      error: 'Failed to add document',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
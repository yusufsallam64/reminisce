import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { updateDocument, deleteDocument, findSimilarDocuments } from '@/lib/rag';
import { semanticSearch } from '@/lib/rag';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { documentId } = req.query;
    if (!documentId || typeof documentId !== 'string') {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    if (req.method === 'GET') {
      // Get document details
      const document = await semanticSearch.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check if user owns the document
      if (document.userId !== session.user.email) {
        return res.status(403).json({ error: 'Access denied' });
      }

      return res.status(200).json({
        success: true,
        document
      });
    }

    if (req.method === 'PUT') {
      // Update document
      const { title, content, tags, summary } = req.body;

      // Verify document ownership
      const document = await semanticSearch.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      if (document.userId !== session.user.email) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await updateDocument({
        documentId,
        title,
        content,
        tags,
        summary
      });

      return res.status(200).json({
        success: true,
        message: 'Document updated successfully'
      });
    }

    if (req.method === 'DELETE') {
      // Delete document
      // Verify document ownership
      const document = await semanticSearch.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      if (document.userId !== session.user.email) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await deleteDocument(documentId);

      return res.status(200).json({
        success: true,
        message: 'Document deleted successfully'
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error handling document request:', error);
    res.status(500).json({
      error: 'Request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
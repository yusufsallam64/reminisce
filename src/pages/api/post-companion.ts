import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import client from '@/lib/db/client';
import companionQuestions from '@/data/companionQuestions.json';

type LovedOne = {
  name: string;
  relationship: string;
}

type CompanionData = {
  userId: string;
  createdAt: Date;
  companionName: string;
  lovedOnes: LovedOne[];
  masterPrompt: string;
  [key: string]: any;
};

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  status: string;
  file?: File;
};

function generateMasterPrompt(formData: any): string {
  // Function to create a sentence from question label and response
  const createDetailSentence = (label: string, value: any): string => {
    // Remove any trailing colons or question marks from the label
    const cleanLabel = label.replace(/[?:]+$/, '').trim();
    return `${cleanLabel}: ${value}`;
  };

  // Generate sections based on companionQuestions structure
  const sections = Object.entries(companionQuestions).map(([category, section]) => {
    const details = section.questions
      .filter(question => 
        question.type !== 'loved-ones' && 
        formData[question.id] && 
        formData[question.id].trim() !== ''
      )
      .map(question => 
        createDetailSentence(question.label, formData[question.id])
      )
      .join('\n');

    return {
      title: section.title,
      content: details
    };
  });

  // Handle loved ones separately since it's a special case
  const lovedOnesSection = formData.lovedOnes
    .filter((person: LovedOne) => person.name && person.relationship)
    .map((person: LovedOne) => 
      `Family/Friend: ${person.name} (${person.relationship})`
    )
    .join('\n');

  // Construct the master prompt
  const prompt = `
    You are a companion to someone with dementia. Here are the important details about the person you're helping (Ignore any details that don't make sense):

    ${sections
      .filter(section => section.content)
      .map(section => `${section.title}:\n${section.content}`)
      .join('\n\n')}

    Family and Relationships:
    ${lovedOnesSection}

        Your job is to help them remember important details about their life. 
        Provide short, concise answers that provide them with companionship. 
        Keep responses simple and avoid complex language. 
        If the user demonstrates confusion, provide them with a reminder of the context. 
        If they have any important reminders or duties that they must remember to perform, periodically include reminders within messages. 
        The user may ask you to repeat information, so be prepared to do so. 
        If the user's message contains any potentially distressed/sad/angry messages, work to alleviate these emotions and relax them."

  `.trim();

  return prompt;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await client.connect();
    const db = client.db('DB');
    
    const formData = req.body;
    
    // Generate the master prompt from form data
    const masterPrompt = generateMasterPrompt(formData);

    // Create the companion document with the master prompt
    const companionData = {
      userId: session.user.email,
      voiceId: formData.voiceId,
      companionName: formData.name,
      createdAt: new Date(),
      masterPrompt: masterPrompt,
      documentIds: [] as string[], // Will be populated with processed document IDs
      hasDocuments: false,
      documentCount: 0
    };

    const result = await db.collection('Companions').insertOne(companionData);
    const companionId = result.insertedId.toString();

    // Note: Document processing is now handled by the Python embedding service
    // Documents will be processed separately via the /process-document endpoint
    const uploadedFiles = formData.uploadedFiles as UploadedFile[] || [];
    
    if (uploadedFiles.length > 0) {
      // Update companion to indicate it has pending documents
      await db.collection('Companions').updateOne(
        { _id: result.insertedId },
        {
          $set: {
            hasDocuments: false, // Will be set to true after Python processing
            documentCount: 0, // Will be updated after processing
            pendingDocuments: uploadedFiles.length,
            lastDocumentUpdate: new Date()
          }
        }
      );
      console.log(`Companion ${companionId} created with ${uploadedFiles.length} pending documents for processing`);
    }

    return res.status(200).json({
      message: 'Companion created successfully',
      companionId: companionId,
      pendingDocuments: uploadedFiles.length,
      hasUploadedFiles: uploadedFiles.length > 0
    });

  } catch (error) {
    console.error('Error creating companion:', error);
    return res.status(500).json({ message: 'Error creating companion' });
  } finally {
    if (process.env.NODE_ENV !== 'development') {
      await client.close();
    }
  }
}
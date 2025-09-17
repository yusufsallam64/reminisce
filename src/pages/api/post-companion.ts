import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import client from '@/lib/db/client';
import companionQuestions from '@/data/companionQuestions.json';

// Configure API route to handle larger payloads for file uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

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
  base64Data?: string;
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

    // Process documents with Python RAG service if files are uploaded
    const uploadedFiles = formData.uploadedFiles as UploadedFile[] || [];
    let documentProcessingSuccess = true;
    let processedCount = 0;

    if (uploadedFiles.length > 0) {
      try {
        console.log(`Processing ${uploadedFiles.length} documents with Python RAG service...`);
        const ragServiceUrl = process.env.PYTHON_RAG_SERVICE_URL || 'http://localhost:8000';

        // Process each file individually (Python service expects one file per request)
        for (const fileItem of uploadedFiles) {
          if (fileItem.base64Data) {
            try {
              console.log(`Processing file: ${fileItem.name}`);

              // Convert base64 back to Buffer
              const buffer = Buffer.from(fileItem.base64Data, 'base64');

              // Create FormData for this individual file
              const formDataToSend = new FormData();

              // Create a Blob with proper metadata
              const blob = new Blob([buffer], { type: fileItem.type });
              formDataToSend.append('file', blob, fileItem.name);
              formDataToSend.append('title', fileItem.name); // Required by Python service
              formDataToSend.append('user_id', session.user.email);
              formDataToSend.append('companion_id', companionId);

              const processResponse = await fetch(`${ragServiceUrl}/process-document`, {
                method: 'POST',
                body: formDataToSend,
              });

              if (processResponse.ok) {
                console.log(`Successfully processed file: ${fileItem.name}`);
                processedCount++;
              } else {
                const errorText = await processResponse.text();
                console.error(`Failed to process file ${fileItem.name}:`, processResponse.status, errorText);
                documentProcessingSuccess = false;
              }
            } catch (fileError) {
              console.error(`Error processing file ${fileItem.name}:`, fileError);
              documentProcessingSuccess = false;
            }
          }
        }

        // Update companion based on processing results
        if (processedCount > 0) {
          console.log(`Successfully processed ${processedCount}/${uploadedFiles.length} documents`);

          await db.collection('Companions').updateOne(
            { _id: result.insertedId },
            {
              $set: {
                hasDocuments: true,
                documentCount: processedCount,
                lastDocumentUpdate: new Date(),
                ragProcessingStatus: documentProcessingSuccess ? 'completed' : 'partial',
                totalFilesUploaded: uploadedFiles.length
              }
            }
          );
        } else {
          console.error('No documents were successfully processed');
          documentProcessingSuccess = false;

          await db.collection('Companions').updateOne(
            { _id: result.insertedId },
            {
              $set: {
                hasDocuments: false,
                documentCount: 0,
                ragProcessingStatus: 'failed',
                ragProcessingError: 'No documents could be processed',
                lastDocumentUpdate: new Date()
              }
            }
          );
        }
      } catch (error) {
        console.error('Error connecting to Python RAG service:', error);
        documentProcessingSuccess = false;

        // Update companion to indicate failed processing
        await db.collection('Companions').updateOne(
          { _id: result.insertedId },
          {
            $set: {
              hasDocuments: false,
              documentCount: 0,
              ragProcessingStatus: 'failed',
              ragProcessingError: error instanceof Error ? error.message : 'Unknown error',
              lastDocumentUpdate: new Date()
            }
          }
        );
      }
    }

    return res.status(200).json({
      message: 'Companion created successfully',
      companionId: companionId,
      documentsProcessed: uploadedFiles.length,
      documentProcessingSuccess: documentProcessingSuccess,
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
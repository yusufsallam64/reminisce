import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import companionQuestions from '@/data/companionQuestions.json';
import {getServerSession} from "next-auth/next";
import client from '@/lib/db/client'; 
import { authOptions } from '@/pages/api/auth/[...nextauth]';

import AudioRecorder from '@/components/AudioRecorder';
import DocumentUploader from '@/components/DocumentUploader';

const CreateCompanionForm = () => {
   const router = useRouter();
   const { data: session } = useSession();
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [error, setError] = useState('');
   const [processingStatus, setProcessingStatus] = useState('');

   const [voiceId, setVoiceId] = useState(null);
   const [uploadedFiles, setUploadedFiles] = useState([]);

   const initialState = Object.entries(companionQuestions).reduce((acc, [category, { questions }]) => {
      questions.forEach(q => {
         if (q.type === 'loved-ones') {
            acc[q.id] = [{ name: '', relationship: '' }];
         } else {
            acc[q.id] = '';
         }
      });
      return acc;
   }, {});

   const [formData, setFormData] = useState(initialState);

   const handleKeyDown = (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
         e.preventDefault();
      }
   };

   const handleChange = (id, value) => {
      setFormData(prev => ({
         ...prev,
         [id]: value
      }));
   };

   const handleLovedOneChange = (index, field, value) => {
      const newLovedOnes = [...formData.lovedOnes];
      newLovedOnes[index][field] = value;
      setFormData(prev => ({
         ...prev,
         lovedOnes: newLovedOnes
      }));
   };

   const addLovedOne = () => {
      setFormData(prev => ({
         ...prev,
         lovedOnes: [...prev.lovedOnes, { name: '', relationship: '' }]
      }));
   };

   const SectionTitle = ({ children }) => (
      <div className="w-full text-center mb-6">
         <h2 className="text-2xl font-bold text-text">{children}</h2>
         <hr className="mt-2 border-accent" />
      </div>
   );

   const renderQuestion = (question) => {
      switch (question.type) {
         case 'textarea':
            return (
               <div key={question.id} className="mb-4">
                  <label className="block text-base font-semibold text-text mb-1">
                     {question.label}
                  </label>
                  <textarea
                     value={formData[question.id]}
                     onChange={(e) => handleChange(question.id, e.target.value)}
                     placeholder={question.placeholder}
                     className="w-full p-2 bg-primary rounded-md text-text placeholder:text-text focus:ring-primary-500 focus:border-primary-500 h-24"
                  />
               </div>
            );

         case 'loved-ones':
            return (
               <div key={question.id} className="mb-4">
                  <label className="block text-base font-semibold text-text mb-1">
                     {question.label}
                  </label>
                  {formData.lovedOnes.map((person, index) => (
                     <div key={index} className="flex gap-2 mb-2">
                        <input
                           type="text"
                           value={person.name}
                           onChange={(e) => handleLovedOneChange(index, 'name', e.target.value)}
                           className="w-1/2 p-2 bg-primary rounded-md text-text placeholder:text-text"
                           placeholder="Name"
                        />
                        <input
                           type="text"
                           value={person.relationship}
                           onChange={(e) => handleLovedOneChange(index, 'relationship', e.target.value)}
                           placeholder="Relationship"
                           className="w-1/2 p-2 bg-primary rounded-md text-text placeholder:text-text"
                        />
                        <button
                           type="button"
                           onClick={() => {
                              const newLovedOnes = [...formData.lovedOnes];
                              newLovedOnes.splice(index, 1);
                              setFormData(prev => ({
                                 ...prev,
                                 lovedOnes: newLovedOnes
                              }));
                           }}
                           disabled={formData.lovedOnes.length === 1}
                           className="text-base text-text hover:text-primary-800 bg-secondary p-3 rounded-md disabled:opacity-50"
                        >
                           X
                        </button>
                     </div>
                  ))}
                  <button
                     type="button"
                     onClick={addLovedOne}
                     className="mt-2 text-base text-text border border-secondary hover:bg-primary hover:active:bg-secondary transition-all p-2 px-4 rounded-md"
                  >
                     + Add another loved one
                  </button>
               </div>
            );

         default:
            return (
               <div key={question.id} className="mb-4">
                  <label className="block text-base font-semibold text-text mb-1">
                     {question.label}
                  </label>
                  <input
                     type={question.type}
                     value={formData[question.id]}
                     onChange={(e) => handleChange(question.id, e.target.value)}
                     placeholder={question.placeholder}
                     className="w-full p-2 bg-primary rounded-md text-text placeholder:text-text focus:ring-primary-500 focus:border-primary-500"
                  />
               </div>
            );
      }
   };

   const handleSubmit = async (e) => {
      e.preventDefault();
      setIsSubmitting(true);
      setError('');
      setProcessingStatus('');

      const submissionData = {
         ...formData,
         voiceId: voiceId, // Make sure voiceId is included in submission
         uploadedFiles: uploadedFiles // Include uploaded files
      };

      const hasFiles = uploadedFiles && uploadedFiles.length > 0;

      console.log(submissionData);

      try {
         if (hasFiles) {
            setProcessingStatus('Creating your companion and processing your memories...');
         } else {
            setProcessingStatus('Creating your companion...');
         }

         const response = await fetch('/api/post-companion', {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
            },
            body: JSON.stringify(submissionData),
         });

         if (!response.ok) {
            throw new Error('Failed to create companion');
         }

         const data = await response.json();

         // Check if document processing was successful
         if (data.hasUploadedFiles && !data.documentProcessingSuccess) {
            console.warn('Document processing failed, but companion was created');
            setError('Companion created, but some documents couldn\'t be processed. You can try re-uploading them later.');
         } else if (data.hasUploadedFiles && data.documentProcessingSuccess) {
            setProcessingStatus('Successfully processed your memories! Redirecting...');
         } else {
            setProcessingStatus('Companion created! Redirecting...');
         }

         // Small delay to show success message
         setTimeout(() => {
            router.push('/companion');
         }, 1500);

      } catch (error) {
         console.error('Error creating companion:', error);
         setError('Failed to create companion. Please try again.');
         setProcessingStatus('');
      } finally {
         setIsSubmitting(false);
      }
   };


   return (
      <div className="max-w-3xl mx-auto p-6">
         <div className=" rounded-lg">
            <div className="p-6">
               <form onSubmit={handleSubmit} className="space-y-8">
                  {Object.entries(companionQuestions).map(([category, { title, questions }]) => (
                     <div key={category}>
                        <SectionTitle>{title}</SectionTitle>
                        {questions.map(question => renderQuestion(question))}
                     </div>
                  ))}
                  
                  <div>
                     <SectionTitle>Companion Customization</SectionTitle>
                     <label className=" mt-5 block text-base font-semibold text-text mb-1">
                        Companion Name
                     </label>
                     <input
                        type="text"
                        value={formData.companionName}
                        onChange={(e) => handleChange('companionName', e.target.value)}
                        className="w-full p-2 bg-primary rounded-md text-text placeholder:text-text focus:ring-primary-500 focus:border-primary-500"
                     />

                     <label className=" mt-5 block text-base font-semibold text-text mb-1">
                        Companion Voice
                     </label>
                     <AudioRecorder setVoiceId={setVoiceId} />
                  </div>

                  <div>
                     <SectionTitle>Memory Documents</SectionTitle>
                     <div className="mb-4">
                        <p className="text-text text-sm mb-4">
                           Upload photos, documents, letters, or any files that contain important memories.
                           These will help your companion provide more personalized and meaningful conversations
                           by understanding your unique experiences and relationships.
                        </p>
                        <DocumentUploader
                           onFilesUploaded={setUploadedFiles}
                           error={error}
                        />
                     </div>
                  </div>
                  {/* Processing Status Display */}
                  {(isSubmitting || processingStatus) && (
                     <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                        <div className="flex items-center justify-center space-x-3 mb-3">
                           <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                           <span className="text-blue-800 font-medium text-lg">
                              {processingStatus || 'Processing...'}
                           </span>
                        </div>

                        {uploadedFiles && uploadedFiles.length > 0 && (
                           <div className="text-blue-600 text-sm">
                              <p className="mb-2">
                                 📚 Processing {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} to enhance your companion's memory
                              </p>
                              <p className="text-xs text-blue-500">
                                 This may take a moment as we analyze your documents to create personalized responses
                              </p>
                           </div>
                        )}
                     </div>
                  )}

                  {/* Warning for file uploads */}
                  {uploadedFiles && uploadedFiles.length > 0 && !isSubmitting && (
                     <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                           <div className="text-amber-600 text-xl">⏳</div>
                           <div>
                              <h4 className="text-amber-800 font-medium mb-1">
                                 Memory Processing Notice
                              </h4>
                              <p className="text-amber-700 text-sm">
                                 You've uploaded {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} containing precious memories.
                                 Processing these documents will take a bit longer but will make your companion much more personal and meaningful.
                              </p>
                           </div>
                        </div>
                     </div>
                  )}

                  <div className="flex justify-end">
                     <button
                        type="submit"
                        disabled={isSubmitting}
                        className="text-text border border-secondary px-8 py-3 rounded-md transition-all duration-300 font-semibold disabled:opacity-50 hover:enabled:bg-primary active:enabled:bg-secondary disabled:cursor-not-allowed flex items-center space-x-2"
                     >
                        {isSubmitting && (
                           <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        )}
                        <span>
                           {isSubmitting
                              ? (uploadedFiles && uploadedFiles.length > 0 ? 'Creating & Processing...' : 'Creating...')
                              : 'Create Companion'
                           }
                        </span>
                     </button>
                  </div>
               </form>
            </div>
         </div>
      </div>
   );
};

export async function getServerSideProps(context) {
   const session = await getServerSession(context.req, context.res, authOptions);

   const db = (await client.connect()).db("DB");
   // If the user is already logged in, redirect.
   // Note: Make sure not to redirect to the same page
   // To avoid an infinite loop!
   if (session) {
       if(await db.collection("Companions").findOne({userId: session.user?.email})) {
         return {redirect: {destination: "/companion"}};
       } else {
         return {props: {}};
       }
   } else {
      return {redirect: {destination: "/"}};
   }
}

export default CreateCompanionForm;
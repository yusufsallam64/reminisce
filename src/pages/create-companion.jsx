import React, { useState } from 'react';
import { useRouter } from 'next/router';
import companionQuestions from '@/data/companionQuestions.json';

const CreateCompanionForm = () => {
   const router = useRouter();
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [error, setError] = useState('');

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
                     className="mt-2 text-base text-text hover:text-primary-800 bg-secondary p-2 rounded-md"
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

      console.log(formData);

      try {
         const response = await fetch('/api/post-companion', {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
         });

         if (!response.ok) {
            throw new Error('Failed to create companion');
         }

         const data = await response.json();
         router.push('/dashboard');
      } catch (error) {
         console.error('Error creating companion:', error);
         setError('Failed to create companion. Please try again.');
      } finally {
         setIsSubmitting(false);
      }
   };


   return (
      <div className="max-w-3xl mx-auto p-6">
         <div className=" rounded-lg shadow-lg">
            <div className="p-6">
               <form onSubmit={handleSubmit} className="space-y-8">
                  {Object.entries(companionQuestions).map(([category, { title, questions }]) => (
                     <div key={category}>
                        <SectionTitle>{title}</SectionTitle>
                        {questions.map(question => renderQuestion(question))}
                     </div>
                  ))}

                  <div className="flex justify-end">
                     <button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-primary text-accent px-6 py-2 rounded-md hover:opacity-80 transition-opacity ease-in duration-300 font-semibold disabled:opacity-50"
                     >
                        {isSubmitting ? 'Creating...' : 'Create Companion'}
                     </button>
                  </div>
               </form>
            </div>
         </div>
      </div>
   );
};

export default CreateCompanionForm;
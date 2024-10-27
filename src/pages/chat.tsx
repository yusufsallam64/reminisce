import React, { useState, useCallback, useEffect } from 'react';
import { useChatStore } from '@/pages/api/model/chat-store';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { GetServerSidePropsContext } from 'next/types';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]';

const ChatInput = () => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { addMessage, addResponse, currentUserId, getCurrentUserMessages } = useChatStore();
  const session = useSession()

  useEffect(() => {
    const userId = session.data?.user?.email as string; 
    useChatStore.getState().setCurrentUser(userId);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !currentUserId) return;

    setIsLoading(true);
    setError('');

    // Add user message to store
    addMessage(currentUserId, {
      role: 'user',
      content: message.trim(),
    });

    try {
      const response = await fetch('/api/model/cf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUserId,
          conversationMessages: getCurrentUserMessages(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      addResponse(currentUserId, data.modelResponse);
      
      // Clear input after successful submission
      setMessage('');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [message, currentUserId, addMessage, addResponse, getCurrentUserMessages]);

  if(!session || !session.data || !session.data.user || !session.data.user.email) {
    return (
      <Link href="/auth/signin">Sign in</Link>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className="w-full p-3 pr-12 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading || !currentUserId}
              />
              {error && (
                <p className="absolute -top-6 left-0 text-sm text-red-500">
                  {error}
                </p>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading || !message.trim() || !currentUserId}
            className={`px-4 py-2 rounded-lg flex items-center justify-center ${
              isLoading || !message.trim() || !currentUserId
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            } text-white transition-colors`}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <div className="w-5 h-5">Send</div>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
      return {redirect: {destination: "/auth/signin"}};
  }

  return {props: {session}};
}

export default ChatInput;
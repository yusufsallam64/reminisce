import React, { useState, useCallback, useEffect } from 'react';
import { useChatStore } from '@/pages/api/model/chat-store';
import { useSession } from 'next-auth/react';
import AutoplayTextToSpeech from './AutoplayTextToSpeech';

const ChatInput = () => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { addMessage, addResponse, currentUserId, getCurrentUserMessages, companionName } = useChatStore();
  const { data: session } = useSession();
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  
  // Fetch voice ID on component mount
  useEffect(() => {
    const fetchVoiceId = async () => {
      if (!session?.user?.email) return;
      
      try {
        const response = await fetch('/api/get-companion-voice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: session.user.email }),
        });
        
        if (!response.ok) throw new Error('Failed to fetch voice ID');
        
        const data = await response.json();

        console.log("Found Voice ID: ", data.companionVoiceId);
        setVoiceId(data.companionVoiceId);
      } catch (error) {
        console.error('Error fetching voice ID:', error);
      }
    };

    fetchVoiceId();
  }, [session?.user?.email]);

  useEffect(() => {
    const userId = session?.user?.email as string;
    if (userId) {
      useChatStore.getState().setCurrentUser(userId);
    }
  }, [session]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !currentUserId) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      // Add user message to store
      addMessage(currentUserId, {
        role: 'user',
        content: message.trim(),
      });

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
      
      // Clear the input first
      setMessage('');
      
      // Add the response to the store
      addResponse(currentUserId, data.modelResponse);
      
      // Trigger audio playback
      setLastResponse(data.modelResponse);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [message, currentUserId, addMessage, addResponse, getCurrentUserMessages]);

  return (
    <div className="fixed bottom-0 left-0 right-0 p-7">
      {lastResponse && voiceId && (
        <AutoplayTextToSpeech 
          text={lastResponse} 
          voiceId={voiceId}
          key={lastResponse} // Force new instance on new response
        />
      )}
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={"Send a message to " + companionName} 
                className="w-full p-3 pr-12 rounded-lg border border-accent bg-primary shadow-md shadow-primary outline-none text-text font-semibold placeholder:text-text placeholder:font-normal"
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
                ? 'bg-secondary opacity-30'
                : 'bg-secondary hover:opacity-90 '
            } text-white font-semibold`}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="">Send</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
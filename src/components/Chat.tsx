import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useChatStore } from '@/pages/api/model/chat-store';
import { useSession } from 'next-auth/react';
import AutoplayTextToSpeech from './StreamingTextToSpeech';

const ChatInput = () => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [streamingResponse, setStreamingResponse] = useState('');
  const { addMessage, addResponse, currentUserId, getCurrentUserMessages, companionName } = useChatStore();
  const { data: session } = useSession();
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
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
    setStreamingResponse('');
    
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create a new AbortController
    abortControllerRef.current = new AbortController();
    
    try {
      // Add user message to store
      addMessage(currentUserId, {
        role: 'user',
        content: message.trim(),
      });

      // Clear the input
      setMessage('');
      
      const response = await fetch('/api/model/cf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUserId,
          conversationMessages: getCurrentUserMessages(),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let finalResponse = '';

      // Process the stream
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.error) {
                throw new Error(data.error);
              }
              
              if (data.done) {
                // Stream completed
                continue;
              }
              
              // Update the streaming response
              setStreamingResponse(prev => prev + (data.content || ''));
              finalResponse = data.completeResponse || finalResponse;
            } catch (err) {
              console.error('Error parsing SSE data:', err);
            }
          }
        }
      }
      
      // Add the complete response to the store once streaming is done
      if (finalResponse) {
        addResponse(currentUserId, finalResponse);
      }
      
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message || 'An error occurred');
        console.error('Chat error:', err);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [message, currentUserId, addMessage, addResponse, getCurrentUserMessages]);

  // Clean up AbortController on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 p-7">
      {streamingResponse && voiceId && (
        <AutoplayTextToSpeech 
          text={streamingResponse} 
          voiceId={voiceId}
          isStreaming={isLoading}
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
                className="w-full p-3 pr-12 rounded-lg border border-accent bg-primary shadow-md shadow-primary outline-none text-text placeholder:text-text placeholder:font-normal"
                disabled={isLoading || !currentUserId}
              />
              {error && (
                <p className="absolute -top-6 left-0 text-sm text-red-500">
                  {error}
                </p>
              )}
              {isLoading && streamingResponse && (
                <div className="absolute -top-6 right-0 text-sm text-accent">
                  Streaming response...
                </div>
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
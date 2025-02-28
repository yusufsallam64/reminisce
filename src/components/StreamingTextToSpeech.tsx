import React, { useEffect, useState, useRef } from 'react';

interface StreamingTextToSpeechProps {
  text: string;
  voiceId: string;
  isStreaming: boolean;
}

const StreamingTextToSpeech: React.FC<StreamingTextToSpeechProps> = ({ text, voiceId, isStreaming }) => {
  const [audioQueue, setAudioQueue] = useState<HTMLAudioElement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const previousTextRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isFirstRenderRef = useRef(true);

  // Function to process new chunk of text
  const processTextChunk = async (newText: string) => {
    if (!voiceId || !newText) return;

    try {
      // Find new content since last processed text
      const prevText = previousTextRef.current;
      const newContent = newText.slice(prevText.length);
      
      // Only process if we have new content and enough characters
      if (newContent.length < 5) return;
      
      // Update the previous text reference
      previousTextRef.current = newText;
      
      // Get audio for the new content
      const audioBlob = await getAudioForText(newContent, voiceId);
      if (!audioBlob) return;
      
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      
      // Clean up when audio ends
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setAudioQueue(prev => prev.filter(a => a !== audio));
      };
      
      // Add to queue
      setAudioQueue(prev => [...prev, audio]);
      
      // If not already playing, start playing
      if (!isPlaying) {
        setIsPlaying(true);
        audio.play().catch(err => {
          console.error('Error playing audio chunk:', err);
          setError('Failed to play audio');
        });
      }
    } catch (error) {
      console.error('Error processing text chunk:', error);
      setError(error instanceof Error ? error.message : 'Error processing audio');
    }
  };

  // Function to get audio from ElevenLabs
  const getAudioForText = async (text: string, voiceId: string): Promise<Blob | null> => {
    if (process.env.NEXT_PUBLIC_ENABLE_VOICE_REPLICATION?.toLowerCase() !== 'true') {
      console.log("Voice replication is disabled.");
      return null;
    }

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
          optimize_streaming_latency: 4, // Highest optimization for streaming
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch audio from ElevenLabs');
      }

      return await response.blob();
    } catch (error) {
      console.error('Error getting audio from ElevenLabs:', error);
      return null;
    }
  };

  // Effect to play next audio in queue when current one ends
  useEffect(() => {
    const playNextInQueue = () => {
      if (audioQueue.length > 0 && !isPlaying) {
        setIsPlaying(true);
        audioQueue[0].play()
          .then(() => {
            // Audio started playing
          })
          .catch(err => {
            console.error('Error playing queued audio:', err);
            setError('Failed to play audio');
            setIsPlaying(false);
            
            // Remove the problematic audio
            if (audioQueue.length > 0) {
              URL.revokeObjectURL(audioQueue[0].src);
              setAudioQueue(prev => prev.slice(1));
            }
          });
      }
    };

    // If we have audio in queue and nothing is playing, start playing
    if (audioQueue.length > 0 && !isPlaying) {
      playNextInQueue();
    }

    // Attempt to play audio when it becomes available
    const intervalId = setInterval(() => {
      if (audioQueue.length > 0 && !isPlaying) {
        playNextInQueue();
      }
    }, 500);

    return () => clearInterval(intervalId);
  }, [audioQueue, isPlaying]);

  // Effect to process new text when it changes
  useEffect(() => {
    // Only start processing after the initial component mount
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      previousTextRef.current = text;
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce processing to avoid too many requests
    timeoutRef.current = setTimeout(() => {
      processTextChunk(text);
    }, 800);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up all audio elements
      audioQueue.forEach(audio => {
        audio.pause();
        URL.revokeObjectURL(audio.src);
      });
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [audioQueue]);

  if (error) {
    return (
      <button 
        disabled
        className="fixed bottom-24 right-4 px-4 py-2 bg-red-500/50 text-text rounded-lg opacity-50 cursor-not-allowed"
      >
        Error: {error}
      </button>
    );
  }

  return null;
};

export default StreamingTextToSpeech;
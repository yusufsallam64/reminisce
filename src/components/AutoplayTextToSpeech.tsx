import React, { useEffect, useState } from 'react';

interface AutoplayTextToSpeechProps {
  text: string;
  voiceId: string;
}

const AutoplayTextToSpeech: React.FC<AutoplayTextToSpeechProps> = ({ text, voiceId }) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  // Get audio data when text changes
  useEffect(() => {
    if (!text || !voiceId) return;

    const getAudio = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId, {
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
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch audio');
        }

        const audioBlob = await response.blob();
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Create and set up audio element
        const newAudio = new Audio(url);
        newAudio.onended = () => {
          URL.revokeObjectURL(url);
          setAudioUrl(null);
          setAudio(null);
        };
        setAudio(newAudio);

        // If user has granted permission, play automatically
        const hasPermission = localStorage.getItem('audioPermission') === 'granted';
        if (hasPermission) {
          await newAudio.play().catch(console.error);
        }

      } catch (error) {
        console.error('Error getting audio:', error);
        setError(error instanceof Error ? error.message : 'Error loading audio');
      } finally {
        setIsLoading(false);
      }
    };

    getAudio();

    // Cleanup function
    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [text, voiceId]);

  const handlePlay = async () => {
    if (!audio) return;
    
    try {
      await audio.play();
      localStorage.setItem('audioPermission', 'granted');
    } catch (error) {
      console.error('Error playing audio:', error);
      setError('Failed to play audio');
    }
  };

  if (isLoading) {
    return (
      <button 
        disabled
        className="fixed bottom-24 right-4 px-4 py-2 bg-accent/50 text-text rounded-lg opacity-50 cursor-not-allowed"
      >
        Loading audio...
      </button>
    );
  }

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

  if (audioUrl && audio && !localStorage.getItem('audioPermission')) {
    return (
      <button
        onClick={handlePlay}
        className="fixed bottom-24 right-4 px-4 py-2 bg-accent hover:bg-secondary text-text rounded-lg transition-colors"
      >
        Play Response
      </button>
    );
  }

  return null;
};

export default AutoplayTextToSpeech;
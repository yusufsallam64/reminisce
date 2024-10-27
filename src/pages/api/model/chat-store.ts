import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Message } from './types';

interface ChatMessage extends Message {
  id: string;
}

interface ChatState {
  messages: Record<string, ChatMessage[]>; // userId -> messages
  currentUserId: string | null;
  companionName: string | null;
  addMessage: (userId: string, message: Message) => void; // user message
  addResponse: (userId: string, response: string) => void; // sys message
  clearMessages: (userId: string) => void; // wipes al
  setCurrentUser: (userId: string | null) => void;
  getCurrentUserMessages: () => ChatMessage[];
  fetchCompanionName: (userId: string) => Promise<void>;
  setCompanionName: (name: string | null) => void;
}

const generateMessageId = () => crypto.randomUUID();

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: {},
      currentUserId: null,
      companionName: null,

      setCurrentUser: (userId: string | null) => {
        set({ currentUserId: userId });
      },

      setCompanionName: (name: string | null) => {
        set({ companionName: name });
      },

      fetchCompanionName: async (userId: string) => {
        try {
          const response = await fetch('/api/get-companion-name', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId }),
          });
          
          if (!response.ok) {
            throw new Error('Failed to fetch companion name');
          }
          
          const data = await response.json();
          get().setCompanionName(data.companionName);
        } catch (error) {
          console.error('Error fetching companion name:', error);
          get().setCompanionName(null);
        }
      },

      addMessage: (userId: string, message: Message) => {
        set((state) => {
          const userMessages = state.messages[userId] || [];
          const newMessage: ChatMessage = {
            ...message,
            id: generateMessageId(),
          };
          
          return {
            messages: {
              ...state.messages,
              [userId]: [...userMessages, newMessage],
            },
          };
        });
      },

      addResponse: (userId: string, response: string) => {
        const responseMessage: Message = {
          role: 'assistant',
          content: response,
        };
        get().addMessage(userId, responseMessage);
      },

      clearMessages: (userId: string) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [userId]: [],
          },
        }));
      },

      getCurrentUserMessages: () => {
        const { currentUserId, messages } = get();
        if (!currentUserId) return [];
        return messages[currentUserId] || [];
      },
    }),
    {
      name: 'chat-storage',
      storage: createJSONStorage(() => sessionStorage), // Use sessionStorage instead of localStorage
      partialize: (state) => ({
        messages: state.messages,
        currentUserId: state.currentUserId,
      }),
    }
  )
);
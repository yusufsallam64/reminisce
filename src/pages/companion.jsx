import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '@/pages/api/model/chat-store';
import Companion3D from '@/components/Companion3D';
import ChatInput from '@/components/Chat';
import SettingsPopup from '@/components/SettingsPopup';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import AudioPermissionDialog from '@/components/AudioPermissionDialog';

const Companion = () => {
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   const [isSettingsOpen, setIsSettingsOpen] = useState(false);
   const [isClient, setIsClient] = useState(false);
   const { getCurrentUserMessages, fetchCompanionName, companionName } = useChatStore();
   const { data: session } = useSession();
   const [showPermissionDialog, setShowPermissionDialog] = useState(false);
   const bottomRef = useRef(null);

   useEffect(() => {
      const hasSeenDialog = localStorage.getItem('hasSeenAudioDialog') === 'true';
      if (!hasSeenDialog) {
        setShowPermissionDialog(true);
      }
    }, []);

    const handleAllowAudio = () => {
      localStorage.setItem('audioPermission', 'granted');
      localStorage.setItem('hasSeenAudioDialog', 'true');
      setShowPermissionDialog(false);
    };
  
    const handleDenyAudio = () => {
      localStorage.setItem('audioPermission', 'denied');
      localStorage.setItem('hasSeenAudioDialog', 'true');
      setShowPermissionDialog(false);
    };
  

   // Handle client-side mounting
   useEffect(() => {
      setIsClient(true);
   }, []);

   useEffect(() => {
      if (session?.user?.email) {
         fetchCompanionName(session.user.email);
      }
   }, [session?.user?.email, fetchCompanionName]);

   useEffect(() => {
      if (isSidebarOpen && bottomRef.current) {
         bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      }
   }, [isSidebarOpen]);


   const messages = isClient && session?.user?.email ? getCurrentUserMessages() : [];

   const ChatHistorySidebar = () => (
      <>
         <div
            className={`fixed top-0 left-0 h-full w-80 bg-background shadow-[5px_0_30px_0_rgba(0,0,0,0.1)] 
         transform transition duration-500 ease-in-out
         ${isSidebarOpen ? 'translate-x-0' : '-translate-x-80 sm:duration-700'}
         overflow-hidden
         z-50`}
         >
            <div className="w-80">
               <div className="flex justify-between items-center p-4 border-b border-accent">
                  <h2 className="text-lg font-semibold text-text">Chat History</h2>
                  <button
                     onClick={() => setIsSidebarOpen(false)}
                     className="p-1 text-text rounded-full transition-colors"
                  >
                     X
                  </button>
               </div>

               <div className="p-4">
                  {messages && messages.length > 0 ? (
                     <div className="space-y-4 h-[89vh] overflow-y-scroll">
                        {messages.map((msg, idx) => (
                           <div
                              key={idx}
                              className={`p-3 rounded-lg text-text ${msg.role === 'user'
                                 ? 'bg-primary ml-4'
                                 : 'bg-secondary mr-4'
                                 }`}
                           >
                              <p className="text-xs font-medium mb-1 opacity-70">
                                 {msg.role === 'user' ? 'You' : companionName || 'Companion'}
                              </p>
                              <p className="text-sm">{msg.content}</p>
                           </div>
                        ))}
                     </div>
                  ) : (
                     <p className="text-center opacity-70 mt-4 text-text">No messages yet</p>
                  )}
                  <div ref={bottomRef} id="chat-bottom" />
               </div>
            </div>
         </div>

         {/* Overlay - separate from sidebar for clean transitions */}
         {isSidebarOpen && (
            <div
               className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 
            transition-opacity duration-500 ease-in-out"
               onClick={() => setIsSidebarOpen(false)}
            />
         )}
      </>
   );

   const ToggleButtonGroup = () => (
      <div>
         <button
            onClick={() => setIsSidebarOpen(true)}
            className="fixed top-4 left-4 p-3 bg-primary hover:bg-secondary  
         rounded-full shadow-lg backdrop-blur-sm transition-colors z-40"
         >
            <Image src="/chat-history.png" width={20} height={20} alt="Chat History" />
         </button>
         <button
            onClick={() => setIsSettingsOpen(true)}
            className="fixed top-20 left-4  p-3 bg-primary hover:bg-secondary
         rounded-full shadow-lg backdrop-blur-sm transition-colors z-40"
         >
            <Image src="/settings.png" width={20} height={20} alt="Settings" />
         </button>

      </div >
   );

   // Don't render anything until client-side hydration is complete
   if (!isClient) {
      return null;
   }

   return (
      <div className="relative">
         {showPermissionDialog && (
            <AudioPermissionDialog 
               onAllow={handleAllowAudio}
               onDeny={handleDenyAudio}
            />
         )}

         <ToggleButtonGroup />
         <ChatHistorySidebar />

         <SettingsPopup 
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
         />

         <div className="m-auto p-auto">
            <Companion3D />
         </div>
         <ChatInput />
      </div>
   );
};

export default Companion;
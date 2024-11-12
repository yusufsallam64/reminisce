import { useSession } from 'next-auth/react';
import React from 'react';

const CalendarTest: React.FC = () => {
    const session = useSession();

    const fetchCalendarEvents = async () => {
        try {
          const response = await fetch('/api/calendar-events');
          if (!response.ok) {
            throw new Error('Failed to fetch calendar events');
          }
          const data = await response.json();
          // Handle the calendar events data
          console.log(data.events);
        } catch (error) {
          console.error('Error fetching calendar events:', error);
          console.error(error);
        }
    };
    
    return (
        <div className="w-24 h-24 bg-pink-500">
            <button onClick={fetchCalendarEvents}>fetch cal data</button>
        </div>
    );
};

export default CalendarTest;
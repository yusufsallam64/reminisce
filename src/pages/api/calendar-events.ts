import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { google } from 'googleapis';
import client from '@/lib/db/client';

if(!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Missing environment variables for Google OAuth');
}

if(!process.env.NEXTAUTH_URL) {
    throw new Error('Missing environment variable NEXTAUTH_URL');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const dbuser = await client.db("test").collection("users").findOne({ email: session.user.email });
    if (!dbuser) {
      console.error("User not found in database");
      return res.status(401).json({ error: 'User not found in database' });
    }

    const dbaccount = await client.db("test").collection('accounts').findOne(({ userId: dbuser._id, provider: 'google' }));
    const accessToken = dbaccount?.access_token;
    if(!accessToken) {
      console.error("No access token found.");
      return res.status(401).json({ error: 'Access token not found' });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const calResponse = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return res.status(200).json({ events: calResponse.data.items });

    } catch (error) {
        console.error('Calendar API Error:', error);
        return res.status(500).json({
        error: 'Failed to fetch calendar events',
        details: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
}
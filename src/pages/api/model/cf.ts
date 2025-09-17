import type { NextApiRequest, NextApiResponse } from "next";
import { Message } from "./types";
import client from "@/lib/db/client";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { fetchCalendarEvents } from "../get-calendar-events";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!req.method || req.method !== "POST") {
    res.status(405).json({ modelResponse: "Method not allowed" });
    return;
  }

  if (!req.body || !req.body.conversationMessages) {
    res.status(400).json({ modelResponse: "Bad request" });
    return;
  }

  const { userId, conversationMessages } = req.body;

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    res.status(401).json({ modelResponse: "Unauthorized" });
    return;
  }

  if (userId !== session.user?.email) {
    res.status(403).json({ modelResponse: "Forbidden" });
    return;
  }

  // Set headers for streaming
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
  });

  try {
    // Fetch companion data
    const companion = await client.db("DB").collection("Companions").findOne({ userId: session.user?.email });

    if (!companion) {
      res.write(`data: ${JSON.stringify({ error: "Companion not found" })}\n\n`);
      res.end();
      return;
    }

    // Get the latest user message for RAG context retrieval
    const latestUserMessage = conversationMessages
      .filter((msg: any) => msg.role === 'user')
      .slice(-1)[0]?.content || '';

    // Search for relevant documents using Python RAG service
    let relevantContext = '';
    if (latestUserMessage && companion.hasDocuments) {
      try {
        const searchResponse = await fetch(`${process.env.PYTHON_RAG_SERVICE_URL}/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: latestUserMessage,
            user_id: session.user.email,
            companion_id: companion._id.toString(),
            limit: 3
          })
        });

        if (searchResponse.ok) {
          const searchResults = await searchResponse.json();
          if (searchResults.results && searchResults.results.length > 0) {
            relevantContext = '\n\nRelevant memories and documents:\n' +
              searchResults.results.map((doc: any, index: number) =>
                `Memory ${index + 1}: ${doc.title || 'Document'}\n${doc.content.substring(0, 300)}${doc.content.length > 300 ? '...' : ''}`
              ).join('\n\n');
          }
        }
      } catch (error) {
        console.error('Error retrieving RAG context from Python service:', error);
        // Continue without RAG context if search fails
      }
    }

    // Fetch calendar events
    const calendarInformation = await fetchCalendarEvents(userId);
    
    const calEvents = (calendarInformation ?? []).map((event: any) => {
      return {
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: event.start.dateTime,
        end: event.end.dateTime,
      }
    });

    const calEventMessages = "You will additionally be provided with information regarding upcoming events that the patient has. Ensure that you are reminding them of these events. \
      Make sure that you tell them in natural language when these events are happening and how far away they are relative to the current time, which you will also be provided. \n \
      If the user is asking for information regarding an event, be concise and do not provide distracting or extra, unnecesssary information. \
      Current Time: " + new Date().toLocaleString() + " \n" +
      calEvents.map((event) => {
        return `Upcoming Event: ${event.summary} \nDescription: ${event.description} \nLocation: ${event.location} \nStart Time: ${event.start} \nEnd Time: ${event.end}`;
      }).join("\n\n");

    const systemPrompt = (companion?.masterPrompt ?? " \
      You are a close relative or companion of an individual with dementia. \
      Your job is to help them remember important details about their life. \
      Provide short, concise answers that provide them with companionship. \
      Keep responses simple and avoid complex language. \
      If the user demonstrates confusion, provide them with a reminder of the context. \
      If they have any important reminders or duties that they must remember to perform, periodically include reminders within messages. \
      The user may ask you to repeat information, so be prepared to do so. \
      If the user's message contains any potentially distressed/sad/angry messages, work to alleviate these emotions and relax them.")
      + calEventMessages
      + relevantContext;

    // Prepare messages for OpenAI
    const openaiMessages = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...conversationMessages.slice(-8).map((message: any) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    // Create stream
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      stream: true,
      temperature: 0.3,
      max_tokens: 256,
    });

    let completeResponse = "";

    // Process the stream
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      completeResponse += content;
      
      // Send the chunk to the client
      res.write(`data: ${JSON.stringify({ content, completeResponse })}\n\n`);
    }

    // End the stream
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Error processing request:", error);
    res.write(`data: ${JSON.stringify({ error: "An error occurred" })}\n\n`);
    res.end();
  }
}
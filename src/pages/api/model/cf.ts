import type { NextApiRequest, NextApiResponse } from "next";
import { AIRequest, AIResponse, Message } from "./types";
import client from "@/lib/db/client";

if (!process.env.CF_API_TOKEN || !process.env.CF_ACCOUNT_ID) {
  throw new Error("Missing required environment variables: CF_API_TOKEN and/or CF_ACCOUNT_ID");
}

if(!process.env.CF_LLM_MODEL) {
  throw new Error("Missing required environment variable: CF_LLM_MODEL");
}

type Data = {
  modelResponse: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  if(!req.method || req.method !== "POST") {
    res.status(405).json({modelResponse: "Method not allowed"});
    return;
  }

  if(!req.body || !req.body.conversationMessages) {
    res.status(400).json({modelResponse: "Bad request"});
    return;
  }

  const { userId, conversationMessages } = req.body;

  const companion = await client.db("DB").collection("Companions").findOne({ userId: userId });

  console.log("Companion:", companion);

  let messages: Message[] = [
    {
      role: "system",
      content: companion?.masterPrompt ?? " \
        You are a close relative or companion of an individual with dementia. \
        Your job is to help them remember important details about their life. \
        Provide short, concise answers that provide them with companionship. \
        Keep responses simple and avoid complex language. \
        If the user demonstrates confusion, provide them with a reminder of the context. \
        If they have any important reminders or duties that they must remember to perform, periodically include reminders within messages. \
        The user may ask you to repeat information, so be prepared to do so. \
        If the user's message contains any potentially distressed/sad/angry messages, work to alleviate these emotions and relax them."
    }, 
    ...conversationMessages.slice(-8).map((message: any) => {
      return {
        role: message.role,
        content: message.content,
      };
    })
  ];  

  const modelResponse = await run({ messages });
    
  if(!modelResponse.success) {
    res.status(500).json({modelResponse: modelResponse.errors.map((error) => error.message).join(", ")});
    return;
  }

  res.status(200).json({ modelResponse: modelResponse.result.response });
  return;
}

async function run(input: AIRequest): Promise<AIResponse> {
  const model = process.env.CF_LLM_MODEL;
  console.log("Executing model with input: ", input);

  // TODO --> Fine-tune parameters to get something a bit more suitable for this project
  // Potentially limit the max input tokens 
  const requestBody = {
    ...input,
    max_tokens: 256,  
    temperature: 0.3, // lower temperature = more deterministic (0.0 - 1.0)
    top_p: 0.9,      // nucleus sampling (lower = more focused)
    top_k: 40,       // vocab diversity
    stream: false    
  };

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${model}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(input),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: AIResponse = await response.json();
    console.log("Model response:", result);
    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to run AI model: ${error.message}`);
    }
    throw error;
  }
}


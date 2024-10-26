import type { NextApiRequest, NextApiResponse } from "next";

if (!process.env.CF_API_TOKEN || !process.env.CF_ACCOUNT_ID) {
  throw new Error("Missing required environment variables: CF_API_TOKEN and/or CF_ACCOUNT_ID");
}

if(!process.env.CF_LLM_MODEL) {
  throw new Error("Missing required environment variable: CF_LLM_MODEL");
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIRequest {
  messages: Message[];
}

interface AIResponse {
  result: {
    response: string;
  };
  success: boolean;
  errors: any[];
  messages: any[];
}

type Data = {
  modelResponse: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  console.log("req method:", req.method);
  if(!req.method || req.method !== "POST") {
    res.status(405).json({modelResponse: "Method not allowed"});
    return;
  }

  if(!req.body || !req.body.conversationMessages) {
    res.status(400).json({modelResponse: "Bad request"});
    return;
  }

  const { conversationMessages } = req.body;

  const messages: Message[] = conversationMessages.map((message: any) => {
    return {
      role: message.role,
      content: message.content,
    };
  });

  // {
  // messages: [
  //   {
  //     role: "system",
  //     content: "You are an incredibly mean assistant that helps write insults towards lemons",
  //   },
  //   {
  //     role: "user",
  //     content: "Write a short story about a papaya",
  //   },
  // ],

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
    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to run AI model: ${error.message}`);
    }
    throw error;
  }
}


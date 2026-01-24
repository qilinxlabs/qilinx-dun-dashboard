import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getMessageById, updateMessage } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const { messageId, toolCallId, result } = await request.json();

    if (!messageId || !toolCallId || !result) {
      return new ChatSDKError('bad_request:api').toResponse();
    }

    // Get the message
    const [message] = await getMessageById({ id: messageId });
    if (!message) {
      return new ChatSDKError('not_found:database', 'Message not found').toResponse();
    }

    // Find the tool part and update it with the result
    const updatedParts = (message.parts as any[]).map((part: any) => {
      if (part.toolCallId === toolCallId && part.output) {
        return {
          ...part,
          output: {
            ...part.output,
            ...result,
          },
        };
      }
      return part;
    });

    // Update the message in the database
    await updateMessage({
      id: messageId,
      parts: updatedParts,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update tool result:', error);
    return new ChatSDKError('bad_request:database', 'Failed to update tool result').toResponse();
  }
}

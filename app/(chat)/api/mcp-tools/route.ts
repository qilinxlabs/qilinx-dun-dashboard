import { auth } from "@/app/(auth)/auth";
import { getMCPToolsWithUserState } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const tools = await getMCPToolsWithUserState({ userId: session.user.id });

    return Response.json({ tools });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    console.error("Failed to get MCP tools:", error);
    return new ChatSDKError("bad_request:api").toResponse();
  }
}

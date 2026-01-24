import { auth } from "@/app/(auth)/auth";
import { getMCPToolById, toggleMCPToolForUser } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { z } from "zod";

const patchSchema = z.object({
  isEnabled: z.boolean(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { id } = await params;

    // Verify the tool exists
    const tool = await getMCPToolById({ id });
    if (!tool) {
      return new ChatSDKError("not_found:database", "MCP tool not found").toResponse();
    }

    // Parse and validate request body
    const body = await request.json();
    const { isEnabled } = patchSchema.parse(body);

    // Update user's tool config
    await toggleMCPToolForUser({
      userId: session.user.id,
      toolId: id,
      isEnabled,
    });

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    if (error instanceof z.ZodError) {
      return new ChatSDKError("bad_request:api", "Invalid request body").toResponse();
    }
    console.error("Failed to update MCP tool:", error);
    return new ChatSDKError("bad_request:api").toResponse();
  }
}

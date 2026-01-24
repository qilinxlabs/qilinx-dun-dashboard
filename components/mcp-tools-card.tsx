"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "./toast";
import { LoaderIcon } from "./icons";

interface MCPTool {
  id: string;
  name: string;
  description: string | null;
  host: string;
  isEnabled: boolean;
}

interface MCPToolsCardProps {
  tools: MCPTool[];
}

export function MCPToolsCard({ tools: initialTools }: MCPToolsCardProps) {
  const [tools, setTools] = useState(initialTools);
  const [loadingToolId, setLoadingToolId] = useState<string | null>(null);

  const handleToggle = async (toolId: string, currentEnabled: boolean) => {
    setLoadingToolId(toolId);
    
    try {
      const response = await fetch(`/api/mcp-tools/${toolId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !currentEnabled }),
      });

      if (!response.ok) {
        throw new Error("Failed to update tool");
      }

      // Update local state
      setTools(tools.map(tool => 
        tool.id === toolId 
          ? { ...tool, isEnabled: !currentEnabled }
          : tool
      ));

      toast({
        type: "success",
        description: `Tool ${!currentEnabled ? "enabled" : "disabled"}`,
      });
    } catch (error) {
      toast({
        type: "error",
        description: "Failed to update tool setting",
      });
    } finally {
      setLoadingToolId(null);
    }
  };

  if (tools.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-2">MCP Tools</h3>
        <p className="text-sm text-muted-foreground">
          No MCP tools are currently configured. Tools will appear here when available.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="text-lg font-semibold mb-2">MCP Tools</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Enable or disable external AI tools for your chat sessions.
      </p>

      <div className="space-y-3">
        {tools.map((tool) => (
          <div
            key={tool.id}
            className="flex items-center justify-between p-3 rounded-lg border bg-background"
          >
            <div className="flex-1 min-w-0 mr-4">
              <h4 className="font-medium text-sm truncate">{tool.name}</h4>
              {tool.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {tool.description}
                </p>
              )}
            </div>
            
            <Button
              variant={tool.isEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => handleToggle(tool.id, tool.isEnabled)}
              disabled={loadingToolId === tool.id}
              className="flex-shrink-0 min-w-[80px]"
              data-testid={`mcp-tool-toggle-${tool.id}`}
            >
              {loadingToolId === tool.id ? (
                <span className="animate-spin">
                  <LoaderIcon />
                </span>
              ) : tool.isEnabled ? (
                "Enabled"
              ) : (
                "Disabled"
              )}
            </Button>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Enabled tools will be available to the AI assistant during chat sessions.
      </p>
    </div>
  );
}

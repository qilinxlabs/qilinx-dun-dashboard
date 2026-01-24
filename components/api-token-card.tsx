"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "./toast";
import { EyeIcon, EyeOffIcon, CopyIcon, RefreshCwIcon, LoaderIcon } from "./icons";

interface ApiTokenCardProps {
  apiToken: string | null;
}

export function ApiTokenCard({ apiToken: initialToken }: ApiTokenCardProps) {
  const [apiToken, setApiToken] = useState(initialToken);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleCopy = async () => {
    if (!apiToken) return;
    
    try {
      await navigator.clipboard.writeText(apiToken);
      toast({
        type: "success",
        description: "API token copied to clipboard",
      });
    } catch (error) {
      toast({
        type: "error",
        description: "Failed to copy token",
      });
    }
  };

  const handleRegenerate = async () => {
    if (!confirm("Are you sure you want to regenerate your API token? This will invalidate the current token.")) {
      return;
    }

    setIsRegenerating(true);
    try {
      const response = await fetch("/api/user/token", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to regenerate token");
      }

      const data = await response.json();
      setApiToken(data.apiToken);
      setIsRevealed(true);
      
      toast({
        type: "success",
        description: "API token regenerated successfully",
      });
    } catch (error) {
      toast({
        type: "error",
        description: "Failed to regenerate token",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const maskedToken = apiToken ? "••••••••-••••-••••-••••-••••••••••••" : "No token";

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="text-lg font-semibold mb-2">API Token</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Use this token to authenticate with MCP tools and external applications.
      </p>

      <div className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground">Token</label>
          <div className="flex items-center gap-2 mt-1">
            <code 
              className="flex-1 font-mono text-sm bg-muted p-2 rounded break-all"
              data-testid="api-token"
            >
              {isRevealed ? apiToken : maskedToken}
            </code>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsRevealed(!isRevealed)}
              disabled={!apiToken}
              title={isRevealed ? "Hide token" : "Reveal token"}
            >
              {isRevealed ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={!apiToken}
              title="Copy token"
            >
              <CopyIcon size={16} />
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="w-full"
          >
            {isRegenerating ? (
              <>
                <span className="animate-spin mr-2">
                  <LoaderIcon />
                </span>
                Regenerating...
              </>
            ) : (
              <>
                <span className="mr-2">
                  <RefreshCwIcon size={16} />
                </span>
                Regenerate Token
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Keep this token secure. Anyone with this token can access your wallet information through MCP tools.
        </p>
      </div>
    </div>
  );
}

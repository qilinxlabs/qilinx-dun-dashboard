"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoaderIcon, CrossIcon } from "./icons";

interface QRCodeGeneratorProps {
  address: string;
  merchantName: string;
  isOpen: boolean;
  onClose: () => void;
  size?: number;
}

export function QRCodeGenerator({
  address,
  merchantName,
  isOpen,
  onClose,
  size = 256,
}: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const generateQRCode = useCallback(() => {
    if (!canvasRef.current || !address) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    // Create a temporary canvas for the QR code
    const tempCanvas = document.createElement("canvas");
    
    QRCode.toCanvas(
      tempCanvas,
      address,
      {
        width: size,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      },
      (err) => {
        if (err) {
          setIsGenerating(false);
          setError("Failed to generate QR code");
          console.error("QR code generation error:", err);
          return;
        }

        // Now draw QR code + address text on the main canvas
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Calculate text dimensions
        const fontSize = 10;
        const lineHeight = 14;
        const padding = 8;
        const maxWidth = size - padding * 2;
        
        ctx.font = `${fontSize}px monospace`;
        
        // Split address into lines that fit
        const lines: string[] = [];
        let currentLine = "";
        for (const char of address) {
          const testLine = currentLine + char;
          if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = char;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);

        const textHeight = lines.length * lineHeight + padding * 2;
        const totalHeight = size + textHeight;

        // Set canvas size
        canvas.width = size;
        canvas.height = totalHeight;

        // Fill white background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, totalHeight);

        // Draw QR code
        ctx.drawImage(tempCanvas, 0, 0, size, size);

        // Draw address text
        ctx.fillStyle = "#000000";
        ctx.font = `${fontSize}px monospace`;
        ctx.textAlign = "center";
        
        lines.forEach((line, index) => {
          const y = size + padding + (index + 1) * lineHeight - 4;
          ctx.fillText(line, size / 2, y);
        });

        setIsGenerating(false);
      }
    );
  }, [address, size]);

  // Generate QR code when dialog opens and canvas is ready
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure canvas is mounted
      const timer = setTimeout(() => {
        generateQRCode();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, generateQRCode]);

  const handleDownload = () => {
    if (!canvasRef.current) return;

    const link = document.createElement("a");
    link.download = `${merchantName.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code for {merchantName}</DialogTitle>
          <DialogDescription>
            Scan this QR code to send payments to this wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4 py-4">
          <div className="relative">
            {isGenerating && (
              <div className="absolute inset-0 flex items-center justify-center bg-background z-10 min-w-[256px] min-h-[256px]">
                <span className="animate-spin">
                  <LoaderIcon size={32} />
                </span>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center text-center bg-background min-w-[256px] min-h-[256px]">
                <CrossIcon size={32} />
                <p className="mt-2 text-sm text-destructive">{error}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Address: {address}
                </p>
              </div>
            )}

            <canvas
              ref={canvasRef}
              className="rounded-lg border"
              data-testid="qr-code-canvas"
            />
          </div>

          <div className="w-full space-y-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCopyAddress}
              >
                Copy Address
              </Button>
              <Button
                className="flex-1"
                onClick={handleDownload}
                disabled={isGenerating || !!error}
              >
                Download QR
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

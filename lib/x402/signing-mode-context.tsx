"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export type SigningMode = "connected-wallet" | "developer-wallet";

interface WalletStatusResponse {
  configured: boolean;
  address?: string;
  error?: string;
}

interface SigningModeContextType {
  mode: SigningMode;
  setMode: (mode: SigningMode) => void;
  isDeveloperWalletConfigured: boolean;
  developerWalletAddress: string | null;
  isLoading: boolean;
  /** Get the active wallet address based on current mode */
  getActiveWalletAddress: (connectedAddress: string | null) => string | null;
}

const SigningModeContext = createContext<SigningModeContextType | null>(null);

export function SigningModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<SigningMode>("developer-wallet");
  const [isDeveloperWalletConfigured, setIsDeveloperWalletConfigured] = useState(false);
  const [developerWalletAddress, setDeveloperWalletAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch developer wallet status on mount
  useEffect(() => {
    const fetchWalletStatus = async () => {
      try {
        const response = await fetch("/api/x402/wallet-status");
        const data: WalletStatusResponse = await response.json();

        setIsDeveloperWalletConfigured(data.configured);
        setDeveloperWalletAddress(data.address || null);
        
        // Default to developer wallet if configured, otherwise connected wallet
        if (data.configured) {
          setModeState("developer-wallet");
        } else {
          setModeState("connected-wallet");
        }
      } catch {
        setIsDeveloperWalletConfigured(false);
        setDeveloperWalletAddress(null);
        setModeState("connected-wallet");
      } finally {
        setIsLoading(false);
      }
    };

    fetchWalletStatus();
  }, []);

  const setMode = useCallback(
    (newMode: SigningMode) => {
      // Don't allow developer wallet mode if not configured
      if (newMode === "developer-wallet" && !isDeveloperWalletConfigured) {
        return;
      }
      setModeState(newMode);
    },
    [isDeveloperWalletConfigured]
  );

  const getActiveWalletAddress = useCallback(
    (connectedAddress: string | null): string | null => {
      if (mode === "developer-wallet") {
        return developerWalletAddress;
      }
      return connectedAddress;
    },
    [mode, developerWalletAddress]
  );

  return (
    <SigningModeContext.Provider
      value={{
        mode,
        setMode,
        isDeveloperWalletConfigured,
        developerWalletAddress,
        isLoading,
        getActiveWalletAddress,
      }}
    >
      {children}
    </SigningModeContext.Provider>
  );
}

export function useSigningMode(): SigningModeContextType {
  const context = useContext(SigningModeContext);
  if (!context) {
    throw new Error("useSigningMode must be used within a SigningModeProvider");
  }
  return context;
}

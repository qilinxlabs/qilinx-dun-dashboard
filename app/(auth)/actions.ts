"use server";

import { z } from "zod";

import { createUser, getUser, getUserByWallet, createWalletUser, updateUserNonce } from "@/lib/db/queries";
import { generateNonce, verifyWalletSignature, isValidSolanaAddress } from "@/lib/auth/wallet-auth";

import { signIn } from "./auth";

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const walletAuthSchema = z.object({
  walletAddress: z.string().refine(isValidSolanaAddress, {
    message: "Invalid Solana wallet address",
  }),
  signature: z.string().min(1),
  message: z.string().min(1),
});

export type LoginActionState = {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
};

export const login = async (
  _: LoginActionState,
  formData: FormData
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

export type RegisterActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data";
};

export const register = async (
  _: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const [user] = await getUser(validatedData.email);

    if (user) {
      return { status: "user_exists" } as RegisterActionState;
    }
    await createUser(validatedData.email, validatedData.password);
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

// ============================================================================
// Wallet Authentication Actions
// ============================================================================

export type WalletLoginActionState = {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_signature";
  nonce?: string;
};

/**
 * Request a nonce for wallet authentication
 */
export const requestWalletNonce = async (
  walletAddress: string
): Promise<{ nonce: string }> => {
  if (!isValidSolanaAddress(walletAddress)) {
    throw new Error("Invalid wallet address");
  }

  const nonce = generateNonce();
  
  // Check if user exists
  const [existingUser] = await getUserByWallet(walletAddress);
  
  if (existingUser) {
    // Update nonce for existing user
    await updateUserNonce(walletAddress, nonce);
  }
  
  return { nonce };
};

/**
 * Login with wallet signature
 */
export const loginWithWallet = async (
  _: WalletLoginActionState,
  data: { walletAddress: string; signature: string; message: string }
): Promise<WalletLoginActionState> => {
  try {
    const validatedData = walletAuthSchema.parse(data);

    // Get user and verify nonce
    const [user] = await getUserByWallet(validatedData.walletAddress);
    
    if (!user) {
      return { status: "failed" };
    }

    // Verify the message matches the stored nonce
    if (user.nonce !== validatedData.message) {
      return { status: "invalid_signature" };
    }

    // Verify the signature
    const isValid = verifyWalletSignature(
      validatedData.walletAddress,
      validatedData.signature,
      validatedData.message
    );

    if (!isValid) {
      return { status: "invalid_signature" };
    }

    // Sign in with wallet provider
    await signIn("wallet", {
      walletAddress: validatedData.walletAddress,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    console.error("Wallet login error:", error);
    if (error instanceof z.ZodError) {
      return { status: "failed" };
    }
    return { status: "failed" };
  }
};

/**
 * Register with wallet
 */
export const registerWithWallet = async (
  walletAddress: string,
  signature: string,
  message: string
): Promise<WalletLoginActionState> => {
  try {
    const validatedData = walletAuthSchema.parse({
      walletAddress,
      signature,
      message,
    });

    // Check if user already exists
    const [existingUser] = await getUserByWallet(validatedData.walletAddress);
    
    if (existingUser) {
      return { status: "failed" };
    }

    // Verify the signature
    const isValid = verifyWalletSignature(
      validatedData.walletAddress,
      validatedData.signature,
      validatedData.message
    );

    if (!isValid) {
      return { status: "invalid_signature" };
    }

    // Create new user
    await createWalletUser(validatedData.walletAddress, validatedData.message);

    // Sign in
    await signIn("wallet", {
      walletAddress: validatedData.walletAddress,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    console.error("Wallet registration error:", error);
    return { status: "failed" };
  }
};

'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js';
import { DunV3Client } from '@/dun-protocol/sdk/src/v3';
import { DunV5Client } from '@/lib/dun/v5';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

const DEVNET_RPC = 'https://api.devnet.solana.com';

interface DunToolExecutorProps {
  toolCall: {
    requiresClientExecution?: boolean;
    action?: string;
    params?: any;
    message?: string;
  };
  toolCallId?: string;
  onComplete?: (result: any) => void;
}

export function DunToolExecutor({ toolCall, toolCallId, onComplete }: DunToolExecutorProps) {
  const wallet = useWallet();
  const connection = useMemo(() => new Connection(DEVNET_RPC, 'confirmed'), []);
  const [status, setStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const executionKey = useRef<string | null>(null);
  const isExecuting = useRef<boolean>(false);

  // Initialize V5 client for X402 payment actions
  const dunV5Client = useMemo(() => {
    if (wallet.publicKey && wallet.signMessage && wallet.signTransaction && wallet.signAllTransactions) {
      try {
        return new DunV5Client(connection, wallet as any);
      } catch (err) {
        console.error('[V5] Failed to initialize client:', err);
        return null;
      }
    }
    return null;
  }, [wallet.publicKey, wallet.signMessage, wallet.signTransaction, wallet.signAllTransactions, connection]);

  useEffect(() => {
    // Create a unique execution key from toolCallId and action
    const currentKey = `${toolCallId}-${toolCall.action}`;
    
    // Only execute once per unique tool call
    if (!toolCall.requiresClientExecution || executionKey.current === currentKey || isExecuting.current) {
      return;
    }

    const executeAction = async () => {
      if (!wallet.publicKey || !wallet.signMessage) {
        setError('Wallet not connected or does not support message signing');
        setStatus('error');
        executionKey.current = currentKey;
        return;
      }

      executionKey.current = currentKey;
      isExecuting.current = true;
      setStatus('executing');
      setError(null);

      try {
        const client = new DunV3Client(connection, wallet as any);

        switch (toolCall.action) {
          case 'checkShieldedBalance': {
            const balance = await client.getBalance('SOL');
            const resultData = {
              success: true,
              totalBalance: balance.totalBalance.toFixed(4),
              unspentCommitments: balance.commitments.filter(c => !c.isSpent).length,
              totalCommitments: balance.commitments.length,
              commitments: balance.commitments.map(c => ({
                amount: c.amount.toFixed(4),
                isSpent: c.isSpent,
                address: c.address,
              })),
              message: `Shielded Pool Balance: ${balance.totalBalance.toFixed(4)} SOL (${balance.commitments.filter(c => !c.isSpent).length} unspent commitments)`,
            };
            setResult(resultData);
            setStatus('success');
            onComplete?.(resultData);
            break;
          }

          case 'wrapSol': {
            const { amount, transaction: transactionBase64 } = toolCall.params;
            
            if (!transactionBase64) {
              setError('No transaction data received from server');
              setStatus('error');
              break;
            }

            // Deserialize transaction
            const transactionBuffer = Buffer.from(transactionBase64, 'base64');
            const transaction = Transaction.from(transactionBuffer);

            // Sign and send transaction
            const signature = await wallet.sendTransaction(transaction, connection);
            
            // Wait for confirmation
            await connection.confirmTransaction(signature, 'confirmed');

            const resultData = {
              success: true,
              amount,
              signature,
              message: `Successfully wrapped ${amount} SOL!`,
            };
            setResult(resultData);
            setStatus('success');
            onComplete?.(resultData);
            break;
          }

          case 'unwrapSol': {
            const { amount, transaction: transactionBase64 } = toolCall.params;
            
            if (!transactionBase64) {
              setError('No transaction data received from server');
              setStatus('error');
              break;
            }

            // Deserialize transaction
            const transactionBuffer = Buffer.from(transactionBase64, 'base64');
            const transaction = Transaction.from(transactionBuffer);

            // Sign and send transaction
            const signature = await wallet.sendTransaction(transaction, connection);
            
            // Wait for confirmation
            await connection.confirmTransaction(signature, 'confirmed');

            const resultData = {
              success: true,
              amount,
              signature,
              message: `Successfully unwrapped ${amount} SOL!`,
            };
            setResult(resultData);
            setStatus('success');
            onComplete?.(resultData);
            break;
          }

          case 'depositToShieldedPool': {
            const { amount } = toolCall.params;
            const signature = await client.deposit({
              amount,
              token: 'SOL',
            });
            const resultData = {
              success: true,
              amount,
              signature,
              message: `Successfully deposited ${amount} SOL into the shielded pool!`,
            };
            setResult(resultData);
            setStatus('success');
            onComplete?.(resultData);
            break;
          }

          case 'withdrawFromShieldedPool': {
            const { amount, recipientAddress } = toolCall.params;
            const signature = await client.withdraw({
              amount,
              token: 'SOL',
              recipient: recipientAddress,
            });
            const resultData = {
              success: true,
              amount,
              recipient: recipientAddress || wallet.publicKey.toBase58(),
              signature,
              message: `Successfully withdrew ${amount} SOL from the shielded pool!`,
            };
            setResult(resultData);
            setStatus('success');
            onComplete?.(resultData);
            break;
          }

          case 'createPaymentRequest': {
            if (!dunV5Client) {
              setError('V5 client not initialized');
              setStatus('error');
              break;
            }

            const { amount, expiresIn = 3600, metadata } = toolCall.params;
            
            try {
              const result = await dunV5Client.createPaymentRequest({
                amount,
                expiresIn,
                metadata,
                wallet: wallet as any,
              });

              const paymentUrl = `${window.location.origin}/x402-payment?request=${result.address.toBase58()}`;
              
              const resultData = {
                success: true,
                amount,
                expiresIn,
                signature: result.signature,
                paymentUrl,
                requestAddress: result.address.toBase58(),
                message: `Payment request created! Expires in ${expiresIn} seconds. Share this URL: ${paymentUrl}`,
              };
              setResult(resultData);
              setStatus('success');
              onComplete?.(resultData);
            } catch (err: any) {
              const errorMsg = err.message || String(err);
              if (errorMsg.includes('already in use') || errorMsg.includes('Allocate: account')) {
                setError(`A payment request for ${amount} SOL already exists from your wallet. Please use a different amount or wait for the existing request to expire.`);
              } else {
                setError(errorMsg);
              }
              setStatus('error');
              onComplete?.({ success: false, error: errorMsg });
            }
            break;
          }

          case 'getMyPaymentRequests': {
            if (!dunV5Client) {
              setError('V5 client not initialized');
              setStatus('error');
              break;
            }

            const requests = await dunV5Client.listPaymentRequests();
            
            const resultData = {
              success: true,
              requests: requests.map((r: any) => ({
                requestId: r.requestId,
                amount: r.amount / LAMPORTS_PER_SOL,
                status: r.status,
                payee: r.payee.toBase58(),
                createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : new Date(r.createdAt).toISOString(),
                expiresAt: r.expiresAt instanceof Date ? r.expiresAt.toISOString() : new Date(r.expiresAt).toISOString(),
                paymentUrl: `${window.location.origin}/x402-payment?request=${r.pda.toBase58()}`,
              })),
              message: `Found ${requests.length} payment request(s)`,
            };
            setResult(resultData);
            setStatus('success');
            onComplete?.(resultData);
            break;
          }

          case 'payPaymentRequest': {
            if (!dunV5Client) {
              setError('V5 client not initialized');
              setStatus('error');
              break;
            }

            const { requestPDA } = toolCall.params;
            const { PublicKey } = await import('@solana/web3.js');
            const pda = new PublicKey(requestPDA);
            
            const signature = await dunV5Client.privacyTransfer({
              paymentRequestPDA: pda,
              wallet: wallet as any,
            });
            
            const resultData = {
              success: true,
              signature,
              requestPDA,
              message: `Payment completed successfully with privacy transfer!`,
            };
            setResult(resultData);
            setStatus('success');
            onComplete?.(resultData);
            break;
          }

          case 'getPaymentRequestDetails': {
            if (!dunV5Client) {
              setError('V5 client not initialized');
              setStatus('error');
              break;
            }

            const { requestPDA } = toolCall.params;
            const { PublicKey } = await import('@solana/web3.js');
            const pda = new PublicKey(requestPDA);
            
            const request = await dunV5Client.getPaymentRequest(pda);
            
            const resultData = {
              success: true,
              requestId: request.requestId,
              amount: request.amount,
              status: request.status,
              payee: request.payee.toBase58(),
              createdAt: request.createdAt instanceof Date ? request.createdAt.toISOString() : new Date(request.createdAt).toISOString(),
              expiresAt: request.expiresAt instanceof Date ? request.expiresAt.toISOString() : new Date(request.expiresAt).toISOString(),
              paidAt: request.paidAt ? (request.paidAt instanceof Date ? request.paidAt.toISOString() : new Date(request.paidAt).toISOString()) : null,
              metadata: request.metadata,
              message: `Payment request for ${request.amount} SOL - Status: ${request.status}`,
            };
            setResult(resultData);
            setStatus('success');
            onComplete?.(resultData);
            break;
          }

          default:
            setError(`Unknown action: ${toolCall.action}`);
            setStatus('error');
        }
      } catch (err: any) {
        console.error('Tool execution error:', err);
        
        // Check if user rejected
        if (err.message?.includes('User rejected') || 
            err.message?.includes('rejected') ||
            err.code === 4001 ||
            err.code === 'ACTION_REJECTED') {
          setError('Transaction cancelled by user');
        } else {
          setError(err.message || 'Execution failed');
        }
        setStatus('error');
        onComplete?.({ success: false, error: err.message });
      } finally {
        isExecuting.current = false;
      }
    };

    executeAction();
  }, []); // Empty dependency array - only run once on mount

  if (!toolCall.requiresClientExecution) {
    return null;
  }

  return (
    <Card className="my-4">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          {status === 'executing' && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
          {status === 'error' && <XCircle className="h-4 w-4 text-red-600" />}
          {toolCall.action === 'checkShieldedBalance' && 'Checking Shielded Pool Balance'}
          {toolCall.action === 'depositToShieldedPool' && 'Depositing to Shielded Pool'}
          {toolCall.action === 'withdrawFromShieldedPool' && 'Withdrawing from Shielded Pool'}
          {toolCall.action === 'wrapSol' && 'Wrapping SOL'}
          {toolCall.action === 'unwrapSol' && 'Unwrapping SOL'}
          {toolCall.action === 'createPaymentRequest' && 'Creating X402 Payment Request'}
          {toolCall.action === 'getMyPaymentRequests' && 'Fetching Payment Requests'}
          {toolCall.action === 'payPaymentRequest' && 'Paying X402 Payment Request'}
          {toolCall.action === 'getPaymentRequestDetails' && 'Fetching Payment Request Details'}
        </CardTitle>
        {toolCall.message && (
          <CardDescription>{toolCall.message}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {status === 'executing' && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              {toolCall.action === 'checkShieldedBalance' && 'Scanning blockchain and generating proofs...'}
              {toolCall.action === 'depositToShieldedPool' && 'Generating zero-knowledge proof (2-3 seconds)... Please sign the transaction in your wallet.'}
              {toolCall.action === 'withdrawFromShieldedPool' && 'Generating zero-knowledge proof (3-5 seconds)... Please sign the transaction in your wallet.'}
              {toolCall.action === 'wrapSol' && 'Wrapping SOL... Please sign the transaction in your wallet.'}
              {toolCall.action === 'unwrapSol' && 'Unwrapping SOL... Please sign the transaction in your wallet.'}
              {toolCall.action === 'createPaymentRequest' && 'Creating payment request... Please sign the transaction in your wallet.'}
              {toolCall.action === 'getMyPaymentRequests' && 'Fetching your payment requests...'}
              {toolCall.action === 'payPaymentRequest' && 'Processing privacy transfer (2-3 seconds)... Please sign the transaction in your wallet.'}
              {toolCall.action === 'getPaymentRequestDetails' && 'Fetching payment request details...'}
            </AlertDescription>
          </Alert>
        )}

        {status === 'success' && result && (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">{result.message}</p>
                {result.signature && (
                  <p className="text-xs font-mono">
                    Signature: {result.signature.slice(0, 8)}...{result.signature.slice(-8)}
                  </p>
                )}
                {result.commitments && result.commitments.length > 0 && (
                  <div className="mt-2 text-xs">
                    <p className="font-medium">Commitments:</p>
                    <ul className="list-disc list-inside">
                      {result.commitments.slice(0, 3).map((c: any, i: number) => (
                        <li key={i}>
                          {c.amount} SOL - {c.isSpent ? 'Spent' : 'Unspent'}
                        </li>
                      ))}
                      {result.commitments.length > 3 && (
                        <li>... and {result.commitments.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {status === 'error' && error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

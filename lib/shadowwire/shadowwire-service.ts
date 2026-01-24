import { ShadowWireClient } from '@radr/shadowwire';
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

export interface TransferParams {
  sender: string;           // Solana wallet address
  recipient: string;        // Recipient Solana address
  amount: number;           // Amount in human-readable units (e.g., 0.5 SOL)
  token: string;            // Token symbol (SOL, USDC, RADR, etc.)
  type: 'internal' | 'external';  // Transfer type
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;  // Wallet signature function
}

export interface TransferResult {
  success: boolean;
  txSignature?: string;     // Solana transaction signature (from result.tx_signature)
  amountHidden?: boolean;   // Whether amount was hidden (from result.amount_hidden)
  error?: string;
}

export interface BalanceInfo {
  available: number;        // Available balance in lamports
  poolAddress: string;      // ShadowWire pool PDA
  token: string;            // Token symbol
}

export interface DepositWithdrawParams {
  wallet: string;
  amount: number;           // Amount in lamports
  signTransaction: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
  connection: Connection;
  sendTransaction: (tx: Transaction | VersionedTransaction, connection: Connection) => Promise<string>;
}

export class ShadowWireService {
  private client: ShadowWireClient;
  
  constructor(debug: boolean = false) {
    this.client = new ShadowWireClient({ debug });
  }
  
  async getWalletBalance(walletAddress: string, connection: Connection): Promise<number> {
    try {
      const publicKey = new PublicKey(walletAddress);
      const balance = await connection.getBalance(publicKey);
      return balance; // Returns balance in lamports
    } catch (error) {
      throw new Error(
        `Failed to fetch wallet balance: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  async getBalance(walletAddress: string, token: string): Promise<BalanceInfo> {
    try {
      const balance = await this.client.getBalance(walletAddress, token as any);
      
      return {
        available: balance.available,
        poolAddress: balance.pool_address,
        token,
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch balance: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  async transfer(params: TransferParams): Promise<TransferResult> {
    try {
      const result = await this.client.transfer({
        sender: params.sender,
        recipient: params.recipient,
        amount: params.amount,
        token: params.token as any,
        type: params.type,
        wallet: { signMessage: params.signMessage },
      });
      
      return {
        success: true,
        txSignature: result.tx_signature,
        amountHidden: result.amount_hidden,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transfer failed',
      };
    }
  }
  
  async deposit(params: DepositWithdrawParams): Promise<string> {
    try {
      // Get unsigned transaction from ShadowWire
      const depositResponse: any = await this.client.deposit({
        wallet: params.wallet,
        amount: params.amount,
      });
      
      console.log('Deposit response:', depositResponse);
      
      // ShadowWire returns an object with unsigned_tx_base64 property
      if (!depositResponse.unsigned_tx_base64) {
        throw new Error('No unsigned transaction in response');
      }
      
      // Deserialize the base64 transaction
      const txBuffer = Buffer.from(depositResponse.unsigned_tx_base64, 'base64');
      const unsignedTx = Transaction.from(txBuffer);
      
      // Sign the transaction with user's wallet
      const signedTx = await params.signTransaction(unsignedTx);
      
      // Send the signed transaction
      const signature = await params.sendTransaction(signedTx, params.connection);
      
      return signature;
    } catch (error) {
      console.error('Deposit error:', error);
      throw new Error(
        `Failed to deposit: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  async withdraw(params: DepositWithdrawParams): Promise<string> {
    try {
      // Get unsigned transaction from ShadowWire
      const withdrawResponse: any = await this.client.withdraw({
        wallet: params.wallet,
        amount: params.amount,
      });
      
      console.log('Withdraw response:', withdrawResponse);
      
      // ShadowWire returns an object with unsigned_tx_base64 property
      if (!withdrawResponse.unsigned_tx_base64) {
        throw new Error('No unsigned transaction in response');
      }
      
      // Deserialize the base64 transaction
      const txBuffer = Buffer.from(withdrawResponse.unsigned_tx_base64, 'base64');
      const unsignedTx = Transaction.from(txBuffer);
      
      // Sign the transaction with user's wallet
      const signedTx = await params.signTransaction(unsignedTx);
      
      // Send the signed transaction
      const signature = await params.sendTransaction(signedTx, params.connection);
      
      return signature;
    } catch (error) {
      console.error('Withdraw error:', error);
      throw new Error(
        `Failed to withdraw: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

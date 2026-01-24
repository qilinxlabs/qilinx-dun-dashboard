export interface DepositParams {
  lamports: number;
}

export interface WithdrawParams {
  lamports: number;
  recipientAddress?: string;
}

export interface BalanceInfo {
  walletBalance: number;
  privateBalance: number;
}

export class PrivacyCashService {
  private privateKey: string | null = null;
  private network: string = 'devnet';

  /**
   * Set the private key for API calls
   */
  setPrivateKey(privateKey: string) {
    this.privateKey = privateKey;
  }

  /**
   * Set the network for API calls
   */
  setNetwork(network: string) {
    this.network = network;
  }

  /**
   * Get both wallet and private balances
   */
  async getBalances(walletAddress: string): Promise<BalanceInfo> {
    if (!this.privateKey) {
      throw new Error('Private key not set. Call setPrivateKey first.');
    }

    try {
      const response = await fetch('/api/privacy-cash/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateKey: this.privateKey,
          walletAddress,
          network: this.network,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch balances');
      }

      const data = await response.json();
      return {
        walletBalance: data.walletBalance,
        privateBalance: data.privateBalance,
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch balances: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Deposit SOL into Privacy Cash
   */
  async deposit(params: DepositParams): Promise<any> {
    if (!this.privateKey) {
      throw new Error('Private key not set. Call setPrivateKey first.');
    }

    try {
      const response = await fetch('/api/privacy-cash/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateKey: this.privateKey,
          lamports: params.lamports,
          network: this.network,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to deposit');
      }

      const data = await response.json();
      return data.result;
    } catch (error) {
      throw new Error(
        `Failed to deposit: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Withdraw SOL from Privacy Cash
   */
  async withdraw(params: WithdrawParams): Promise<any> {
    if (!this.privateKey) {
      throw new Error('Private key not set. Call setPrivateKey first.');
    }

    try {
      const response = await fetch('/api/privacy-cash/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateKey: this.privateKey,
          lamports: params.lamports,
          recipientAddress: params.recipientAddress,
          network: this.network,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to withdraw');
      }

      const data = await response.json();
      return data.result;
    } catch (error) {
      throw new Error(
        `Failed to withdraw: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

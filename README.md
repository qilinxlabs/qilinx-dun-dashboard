# Dun Privacy Protocol

A privacy-preserving payment protocol on Solana using zero-knowledge proofs for shielded transactions.

🚀 **[Live Demo](https://qilinx-dun.vercel.app/)** | 📖 **[Documentation](https://bo0.gitbook.io/dun-protocol)** | 🎥 **[Video Demo](https://youtu.be/LfHkOXI1sdw)**

📦 **[Dun Protocol Repository](https://github.com/qilinxlabs/qilinx-dun-protocol)** | 🤖 **[Dun MCP Repository](https://github.com/qilinxlabs/qilinx-dun-mcp)**

## What is Dun?

Dun is a privacy protocol on Solana that enables shielded transactions using zero-knowledge proofs. It provides:

- **Shielded Pool** - Deposit SOL into a privacy pool, make hidden transfers, and withdraw anonymously
- **x402 Privacy Payments** - Create and pay payment requests with hidden amounts using pool-based atomic transfers
- **Zero-Knowledge Proofs** - All transactions use ZK proofs to hide transaction details while maintaining verifiability

## Features

### AI Chat Assistant
Interact with an AI assistant to manage privacy transactions using natural language:
- Shielded pool operations (deposit, withdraw, transfer)
- x402 privacy payment requests
- Transaction troubleshooting

### Shielded Pool (V3)
Privacy-preserving SOL transactions:
- Deposit SOL into the shielded pool
- Make hidden transfers between users
- Withdraw anonymously with ZK proofs

### x402 Privacy Payments (V5)
Privacy-preserving payment requests:
- Create payment requests with common amounts
- Pay requests using pool-based atomic transfers
- Hidden payment amounts using zero-knowledge proofs

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **AI**: Google Gemini via AI SDK
- **Database**: PostgreSQL with Drizzle ORM
- **Blockchain**: Solana (Devnet for development)
- **Privacy**: Zero-knowledge proofs (Groth16)
- **Styling**: Tailwind CSS + shadcn/ui

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm
- PostgreSQL database
- Solana wallet (Phantom, Solflare, etc.)

### Installation

```bash
# Clone the repository
git clone https://github.com/0xbohu/qilinx-dun.git
cd qilinx-dun

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

### Environment Variables

See `.env.example` for required configuration:

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | Authentication secret (generate with `openssl rand -base64 32`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini API key |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token |
| `POSTGRES_URL` | PostgreSQL database connection string |
| `REDIS_URL` | Redis connection string |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana RPC endpoint (Devnet) |

## Privacy Flow

```
User Wallet → Wrap SOL → Deposit to Pool → Hidden Transfer → Withdraw → Unwrap SOL
```

1. User wraps SOL to create wrapped SOL tokens
2. Deposit wrapped SOL into the shielded pool with ZK proof
3. Make hidden transfers within the pool
4. Withdraw anonymously with ZK proof
5. Unwrap back to native SOL

## Project Structure

```
├── app/                    # Next.js app router pages
│   ├── (auth)/            # Authentication pages
│   ├── (chat)/            # Main application pages
│   └── api/               # API routes
├── components/            # React components
│   ├── chat/              # Chat interface components
│   ├── contracts/         # Contract management UI
│   ├── dapps/             # DApp builder components
│   └── manage-payments/   # Payment management UI
├── contracts/             # Solidity smart contracts
├── lib/                   # Shared utilities
│   ├── ai/                # AI tools and configuration
│   ├── db/                # Database schema and queries
│   └── solana/            # Solana network utilities
└── public/                # Static assets
```

## License

MIT

## Acknowledgments

This project references the x402 protocol implementation from [Nuwa Protocol](https://github.com/nuwa-protocol/x402-exec).

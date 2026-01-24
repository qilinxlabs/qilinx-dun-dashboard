import { client, db } from "./index";
import { mcpTools } from "./schema";

async function seedCryptocomMcp() {
  console.log("Adding Crypto.com Market Data MCP...");
  
  try {
    await db.insert(mcpTools).values({
      name: "Crypto.com Market Data MCP",
      description: "Crypto.com MCP Server",
      host: "https://mcp.crypto.com/market-data/mcp",
      isActive: true,
    });
    
    console.log("✅ Crypto.com Market Data MCP added successfully");
  } catch (error) {
    console.error("❌ Error adding MCP tool:", error);
  } finally {
    await client.end();
  }
}

seedCryptocomMcp();

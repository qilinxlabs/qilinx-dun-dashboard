import "dotenv/config";
import postgres from "postgres";

const client = postgres(process.env.POSTGRES_URL!);

async function check() {
  const agents = await client`SELECT name FROM "Agent"`;
  console.log("Agents:", agents.map(a => a.name));
  
  const mcpTools = await client`SELECT name FROM "MCP_Tools"`;
  console.log("MCP Tools:", mcpTools.map(t => t.name));
  
  const contracts = await client`SELECT name FROM "Contract_Template"`;
  console.log("Contract Templates:", contracts.map(c => c.name));
  
  const dapps = await client`SELECT name FROM "Dapp_Template"`;
  console.log("Dapp Templates:", dapps.map(d => d.name));
  
  await client.end();
}

check();

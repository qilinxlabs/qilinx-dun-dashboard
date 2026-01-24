"use client";

import { Canvas } from "@/components/ai-elements/canvas";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Node as FlowNode, Edge as FlowEdge, NodeTypes, EdgeTypes, EdgeProps, InternalNode, Node } from "@xyflow/react";
import { Handle, Position, BaseEdge, getBezierPath, useInternalNode, ReactFlowProvider } from "@xyflow/react";
import { 
  WalletIcon,
  ShieldIcon,
  BotIcon,
  LockIcon,
  ArrowRightLeftIcon,
  CoinsIcon,
  EyeOffIcon,
} from "lucide-react";

// Node data interface
interface PromoNodeData {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  color: string;
  handles: { target: boolean; source: boolean };
  [key: string]: unknown;
}

// Layout constants
const NODE_WIDTH = 160;
const NODE_HEIGHT = 80;
const HORIZONTAL_GAP = 100;
const VERTICAL_GAP = 100;

// Helper to get handle coordinates
const getHandleCoordsByPosition = (
  node: InternalNode<Node>,
  handlePosition: Position
) => {
  const handleType = handlePosition === Position.Left ? "target" : "source";
  const handle = node.internals.handleBounds?.[handleType]?.find(
    (h) => h.position === handlePosition
  );

  if (!handle) {
    return [0, 0] as const;
  }

  let offsetX = handle.width / 2;
  let offsetY = handle.height / 2;

  switch (handlePosition) {
    case Position.Left:
      offsetX = 0;
      break;
    case Position.Right:
      offsetX = handle.width;
      break;
    case Position.Top:
      offsetY = 0;
      break;
    case Position.Bottom:
      offsetY = handle.height;
      break;
    default:
      break;
  }

  const x = node.internals.positionAbsolute.x + handle.x + offsetX;
  const y = node.internals.positionAbsolute.y + handle.y + offsetY;

  return [x, y] as const;
};

// Animated edge with flowing dot
function AnimatedEdge({ id, source, target, markerEnd, style }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!(sourceNode && targetNode)) {
    return null;
  }

  // Determine handle positions based on node positions
  const sourcePos = sourceNode.internals.positionAbsolute;
  const targetPos = targetNode.internals.positionAbsolute;
  
  let sourcePosition = Position.Right;
  let targetPosition = Position.Left;
  
  // If target is below/above source significantly, use vertical handles
  if (Math.abs(targetPos.y - sourcePos.y) > 50 && Math.abs(targetPos.x - sourcePos.x) < 50) {
    sourcePosition = targetPos.y > sourcePos.y ? Position.Bottom : Position.Top;
    targetPosition = targetPos.y > sourcePos.y ? Position.Top : Position.Bottom;
  }

  const [sx, sy] = getHandleCoordsByPosition(sourceNode, sourcePosition);
  const [tx, ty] = getHandleCoordsByPosition(targetNode, targetPosition);

  const [edgePath] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition,
    targetX: tx,
    targetY: ty,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} markerEnd={markerEnd} path={edgePath} style={style} />
      <circle fill="var(--primary)" r="3">
        <animateMotion dur="2s" path={edgePath} repeatCount="indefinite" />
      </circle>
    </>
  );
}

// Workflow node component
function WorkflowNode({ data }: { data: PromoNodeData }) {
  const { title, description, icon: Icon, color, handles } = data;

  return (
    <Card className={`relative size-full border-2 ${color}`}>
      {handles.target && <Handle position={Position.Left} type="target" className="!bg-primary" />}
      {handles.source && <Handle position={Position.Right} type="source" className="!bg-primary" />}
      {handles.target && <Handle id="top" position={Position.Top} type="target" className="!bg-primary" />}
      {handles.source && <Handle id="bottom" position={Position.Bottom} type="source" className="!bg-primary" />}
      
      <CardHeader className="p-2.5 pb-1.5">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-primary/10 p-1.5">
            {Icon && <Icon className="size-4 text-primary" />}
          </div>
          <CardTitle className="text-xs font-semibold">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-2.5 pt-0">
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

// User node (circular)
function UserNode({ data }: { data: { handles: { target: boolean; source: boolean }; label?: string; icon?: React.ComponentType<{ className?: string }> } }) {
  const Icon = data.icon || WalletIcon;
  return (
    <div className="flex flex-col items-center justify-center size-full gap-1">
      <div className="relative flex items-center justify-center size-14 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg">
        <Icon className="size-7" />
        {data.handles.source && <Handle position={Position.Right} type="source" className="!bg-white" />}
        {data.handles.target && <Handle position={Position.Left} type="target" className="!bg-white" />}
        {data.handles.source && <Handle id="bottom" position={Position.Bottom} type="source" className="!bg-white" />}
        {data.handles.target && <Handle id="top" position={Position.Top} type="target" className="!bg-white" />}
      </div>
      {data.label && (
        <span className="text-[10px] font-medium text-muted-foreground">{data.label}</span>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  workflow: WorkflowNode,
  user: UserNode,
};

const edgeTypes: EdgeTypes = {
  animated: AnimatedEdge,
};

// Calculate positions - horizontal flow
const startX = 0;
const col1X = startX + 80;
const col2X = col1X + NODE_WIDTH + HORIZONTAL_GAP;
const col3X = col2X + NODE_WIDTH + HORIZONTAL_GAP;
const endX = col3X + NODE_WIDTH + HORIZONTAL_GAP;

const centerY = 150;
const topY = centerY - VERTICAL_GAP;
const bottomY = centerY + VERTICAL_GAP;

// Define nodes for Dun Privacy Protocol
const dunFlowNodes: FlowNode[] = [
  // Start: User Wallet
  {
    id: "user-start",
    type: "user",
    position: { x: startX, y: centerY - 28 },
    data: { handles: { target: false, source: true }, label: "Wallet", icon: WalletIcon },
    style: { width: 64, height: 80 },
  },
  // AI Agent
  {
    id: "agent",
    type: "workflow",
    position: { x: col1X, y: centerY - NODE_HEIGHT / 2 },
    data: {
      title: "AI Agent",
      description: "Natural language commands",
      icon: BotIcon,
      color: "border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/30",
      handles: { target: true, source: true },
    },
    style: { width: NODE_WIDTH, height: NODE_HEIGHT },
  },
  // Shielded Pool (top path)
  {
    id: "pool",
    type: "workflow",
    position: { x: col2X, y: topY - NODE_HEIGHT / 2 },
    data: {
      title: "Shielded Pool",
      description: "ZK private transfers",
      icon: ShieldIcon,
      color: "border-purple-500/50 bg-purple-50/50 dark:bg-purple-950/30",
      handles: { target: true, source: true },
    },
    style: { width: NODE_WIDTH, height: NODE_HEIGHT },
  },
  // x402 Payment (bottom path)
  {
    id: "x402",
    type: "workflow",
    position: { x: col2X, y: bottomY - NODE_HEIGHT / 2 },
    data: {
      title: "x402 Payment",
      description: "Hidden amount requests",
      icon: EyeOffIcon,
      color: "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/30",
      handles: { target: true, source: true },
    },
    style: { width: NODE_WIDTH, height: NODE_HEIGHT },
  },
  // Privacy Layer (top)
  {
    id: "privacy",
    type: "workflow",
    position: { x: col3X, y: topY - NODE_HEIGHT / 2 },
    data: {
      title: "Privacy Layer",
      description: "Zero-knowledge proofs",
      icon: LockIcon,
      color: "border-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-950/30",
      handles: { target: true, source: true },
    },
    style: { width: NODE_WIDTH, height: NODE_HEIGHT },
  },
  // Atomic Transfer (bottom)
  {
    id: "atomic",
    type: "workflow",
    position: { x: col3X, y: bottomY - NODE_HEIGHT / 2 },
    data: {
      title: "Atomic Transfer",
      description: "Pool-based settlement",
      icon: ArrowRightLeftIcon,
      color: "border-pink-500/50 bg-pink-50/50 dark:bg-pink-950/30",
      handles: { target: true, source: true },
    },
    style: { width: NODE_WIDTH, height: NODE_HEIGHT },
  },
  // End: Recipient (top)
  {
    id: "recipient-pool",
    type: "user",
    position: { x: endX, y: topY - 28 },
    data: { handles: { target: true, source: false }, label: "Recipient", icon: CoinsIcon },
    style: { width: 64, height: 80 },
  },
  // End: Payee (bottom)
  {
    id: "payee",
    type: "user",
    position: { x: endX, y: bottomY - 28 },
    data: { handles: { target: true, source: false }, label: "Payee", icon: CoinsIcon },
    style: { width: 64, height: 80 },
  },
];

const dunFlowEdges: FlowEdge[] = [
  // User to Agent
  { id: "user-agent", source: "user-start", target: "agent", type: "animated" },
  // Agent to both protocols
  { id: "agent-pool", source: "agent", target: "pool", type: "animated" },
  { id: "agent-x402", source: "agent", target: "x402", type: "animated" },
  // Pool to Privacy Layer
  { id: "pool-privacy", source: "pool", target: "privacy", type: "animated" },
  // x402 to Atomic Transfer
  { id: "x402-atomic", source: "x402", target: "atomic", type: "animated" },
  // Privacy to Recipient
  { id: "privacy-recipient", source: "privacy", target: "recipient-pool", type: "animated" },
  // Atomic to Payee
  { id: "atomic-payee", source: "atomic", target: "payee", type: "animated" },
];

export function PromoCanvas() {
  return (
    <div className="w-full h-[420px] rounded-xl border bg-muted/20 overflow-hidden">
      <ReactFlowProvider>
        <Canvas
          edges={dunFlowEdges}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodes={dunFlowNodes}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
        />
      </ReactFlowProvider>
    </div>
  );
}

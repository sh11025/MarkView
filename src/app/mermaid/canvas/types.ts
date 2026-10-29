import type { FlowchartModel } from '../../../features/mermaid';
import type { NodeLayout } from '../../../features/mermaid/layout';

export type { NodeLayout };

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface NodePositionMap {
  [nodeId: string]: CanvasPosition;
}

export type QuickAddDirection = 'top' | 'bottom' | 'left' | 'right';
export type PortDirection = 'top' | 'bottom' | 'left' | 'right';

export interface ConnectingState {
  fromNodeId: string;
  fromPort: PortDirection;
  currentX: number;
  currentY: number;
}

export interface CanvasProps {
  model: FlowchartModel;
  onChange: (next: FlowchartModel) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  showPreview: boolean;
  onTogglePreview: () => void;
}

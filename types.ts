export enum LiveStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export interface TranscriptItem {
  id: string;
  sender: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface LiveConfig {
  voiceName: string;
}

export type AgentActionType = 'CALL';

export interface AgentAction {
  id: string;
  type: AgentActionType;
  details: string; // e.g., "Calling +201..."
  status: 'pending' | 'completed';
  timestamp: Date;
}

export const DEFAULT_VOICE_NAME = 'Zephyr';
// Auth types
export interface AuthPayload {
  userId: string;
  session: string;
  method: 'email' | 'google' | 'metamask';
}

// User types
export interface User {
  id: string;
  email?: string;
  walletAddress?: string;
  name?: string;
  avatar?: string;
}

// Memory Bucket types
export interface MemoryBucket {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  isPinned?: boolean | null;
  // Sharing metadata (present when fetched from GET /ai/profile)
  isOwner?: boolean;
  role?: 'owner' | 'editor' | 'viewer';
  sharedBy?: {
    id: string;
    email?: string;
    name?: string;
    wallet?: string;
  };
}

// Sharing types
export interface BucketShareEntry {
  id: string;
  bucketId: string;
  grantedToId: string;
  role: 'viewer' | 'editor';
  createdAt: string;
  user?: {
    id: string;
    email?: string;
    name?: string;
    wallet?: string;
  };
}

export interface ShareRequest {
  identifier: string;
  identifierType: 'email' | 'wallet';
  role: 'viewer' | 'editor';
}

// Chat/Message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  type: 'file' | 'link' | 'image';
  name: string;
  url: string;
  size?: number;
}

// Context types
export interface Context {
  id: string;
  name: string;
  type: 'document' | 'url' | 'text' | 'file';
  content?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

// Loading state
export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

type MessageBroadcaster = (workspaceId: string, message: unknown) => void;
type MessageDeletedBroadcaster = (workspaceId: string, messageId: string, attachmentIds: string[]) => void;

let broadcaster: MessageBroadcaster | null = null;
let deletedBroadcaster: MessageDeletedBroadcaster | null = null;

export function registerMessageBroadcaster(next: MessageBroadcaster) {
  broadcaster = next;
}

export function broadcastMessage(workspaceId: string, message: unknown) {
  broadcaster?.(workspaceId, message);
}

export function registerMessageDeletedBroadcaster(next: MessageDeletedBroadcaster) {
  deletedBroadcaster = next;
}

export function broadcastMessageDeleted(
  workspaceId: string,
  messageId: string,
  attachmentIds: string[],
) {
  deletedBroadcaster?.(workspaceId, messageId, attachmentIds);
}
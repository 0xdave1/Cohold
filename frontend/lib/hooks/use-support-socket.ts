'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/lib/hooks/use-websocket';

/**
 * Realtime support updates.
 * - Invalidates conversation list and message thread on new messages.
 */
export function useSupportSocket(conversationId: string | null) {
  const queryClient = useQueryClient();

  const socket = useWebSocket('/ws/support', {
    onSupportMessage: (msg: any) => {
      const cid = String(msg?.conversationId ?? '');
      // Update list and specific thread
      void queryClient.invalidateQueries({ queryKey: ['support', 'conversations'] });
      if (cid) {
        void queryClient.invalidateQueries({ queryKey: ['support', 'messages', cid] });
      }
    },
  });

  useEffect(() => {
    if (!socket || !conversationId) return;
    socket.emit('support:conversation.join', { conversationId });
    return () => {
      socket.emit('support:conversation.leave', { conversationId });
    };
  }, [socket, conversationId]);

  return socket;
}


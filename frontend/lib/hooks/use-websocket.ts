import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';
import { getApiBaseURL } from '@/lib/api/client';

function socketOriginFromApiUrl(): string {
  try {
    const u = new URL(getApiBaseURL());
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'http://localhost:4000';
  }
}

/**
 * WebSocket hook: access JWT from memory is passed in `auth.token` (not stored in cookies).
 */
export function useWebSocket(namespace: '/ws/user' | '/ws/admin' | '/ws/support', callbacks: {
  onKycStatus?: (data: { status: string }) => void;
  onInvestmentProgress?: (data: { propertyId: string; progress: number }) => void;
  onAlert?: (data: { type: string; message: string }) => void;
  onTransaction?: (data: { type: string; amount: string; currency: string }) => void;
  onSupportMessage?: (data: any) => void;
  onSupportPresence?: (data: any) => void;
  onSupportTyping?: (data: any) => void;
}) {
  const socketRef = useRef<Socket | null>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const adminAccessToken = useAuthStore((s) => s.adminAccessToken);

  useEffect(() => {
    const token =
      namespace === '/ws/support'
        ? accessToken || adminAccessToken || null
        : namespace === '/ws/admin'
          ? adminAccessToken
          : accessToken;
    if (!token) return;
    if (namespace === '/ws/user' && (!isAuthenticated || !accessToken)) return;

    const origin = socketOriginFromApiUrl();
    const socket = io(`${origin}${namespace}`, {
      withCredentials: true,
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`Connected to ${namespace}`);
    });

    socket.on('disconnect', () => {
      console.log(`Disconnected from ${namespace}`);
    });

    if (callbacks.onKycStatus) {
      socket.on('kyc-status', callbacks.onKycStatus);
    }

    if (callbacks.onInvestmentProgress) {
      socket.on('investment-progress', callbacks.onInvestmentProgress);
    }

    if (callbacks.onAlert) {
      socket.on('alert', callbacks.onAlert);
    }

    if (callbacks.onTransaction) {
      socket.on('transaction', callbacks.onTransaction);
    }

    if (callbacks.onSupportMessage) {
      socket.on('support:message.new', callbacks.onSupportMessage);
    }
    if (callbacks.onSupportPresence) {
      socket.on('support:presence.update', callbacks.onSupportPresence);
    }
    if (callbacks.onSupportTyping) {
      socket.on('support:typing', callbacks.onSupportTyping);
    }

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, accessToken, adminAccessToken, namespace, callbacks]);

  return socketRef.current;
}

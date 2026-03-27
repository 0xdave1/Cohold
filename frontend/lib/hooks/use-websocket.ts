import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';

/**
 * WebSocket hook for real-time updates.
 * Connects to backend WebSocket gateway based on user role.
 */
export function useWebSocket(namespace: '/ws/user' | '/ws/admin', callbacks: {
  onKycStatus?: (data: { status: string }) => void;
  onInvestmentProgress?: (data: { propertyId: string; progress: number }) => void;
  onAlert?: (data: { type: string; message: string }) => void;
  onTransaction?: (data: { type: string; amount: string; currency: string }) => void;
}) {
  const socketRef = useRef<Socket | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    const socket = io(`${apiUrl}${namespace}`, {
      auth: { token: accessToken },
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

    return () => {
      socket.disconnect();
    };
  }, [accessToken, namespace, callbacks]);

  return socketRef.current;
}

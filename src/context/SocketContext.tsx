"use client";

import { useSession } from 'next-auth/react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  socketError: string | null;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  socketError: null,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== 'authenticated')
      return;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002';
    console.log(`Connecting to socket server at: ${socketUrl}`);

    const socketInstance = io(
      `${socketUrl}`,
      {
        autoConnect: true,
        query: {
          userId: session?.user?.id,
        },
        withCredentials: true,
        transports: ['websocket', 'polling']
      }
    );

    socketInstance.on('connect', () => {
      setIsConnected(true);
      setSocketError(null);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('error', (error) => {
      setSocketError(error.message);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [status, session]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, socketError }}>
      {children}
    </SocketContext.Provider>
  );
}; 
import { useCallback } from "react";
import { useSocket } from "../context/SocketContext";

interface UseSocketIOOptions {
  event: string;
  callback?: (data: any) => void;
}

export const useSocketIO = () => {
  const { socket, isConnected, socketError } = useSocket();

  const emit = useCallback(
    (event: string, data: any) => {
      if (socket && isConnected) {
        socket.emit(event, data);
      }
    },
    [socket, isConnected]
  );

  const on = useCallback(
    ({ event, callback }: UseSocketIOOptions) => {
      if (socket && isConnected && callback) {
        socket.on(event, callback);
      }
    },
    [socket, isConnected]
  );

  const off = useCallback(
    (event: string) => {
      if (socket) {
        socket.off(event);
      }
    },
    [socket]
  );

  return {
    emit,
    on,
    off,
    isConnected,
    socketError,
  };
};

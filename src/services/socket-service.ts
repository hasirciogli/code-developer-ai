import { io, Socket } from "socket.io-client";

export class SocketService {
  private socket: Socket | null = null;

  private async connect() {
    const socket = io(
      (process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3002") +
        "/system"
    );

    socket.on("error", (error) => {
      console.error("Socket error:", error);
      return null;
    });

    return socket;
  }

  async callClientsideFunction(
    functionName: string,
    args: any,
    userId: string
  ): Promise<{
    status: boolean;
    data: any;
  }> {
    if (!this.socket) {
      this.socket = await this.connect();
    }

    return new Promise((resolve) => {
      // Set up a one-time listener for the response
      this.socket?.once(`clientside-call`, (response) => {
        resolve(response);
      });

      // Emit the clientside-call event
      this.socket?.emit("clientside-call", {
        functionName,
        args,
        userId,
      });

      // Set a timeout to resolve with an error if no response is received
      setTimeout(() => {
        resolve({
          status: false,
          data: "Timeout waiting for response",
        });
      }, 6000); // 10 second timeout
    });
  }
}

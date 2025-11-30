import net from "net";
import { PRINTER_HOST, PRINTER_PORT } from "./config";

export async function sendToThermalPrinter(escposBase64: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: PRINTER_HOST, port: PRINTER_PORT }, () => {
      const raw = Buffer.from(escposBase64, "base64");
      socket.write(raw);
      socket.end();
    });

    socket.on("error", (err) => reject(err));
    socket.on("close", () => resolve());
  });
}

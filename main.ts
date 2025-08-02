// websocket_logger.ts

// @deno-types="npm:terminal-kit"
import terminalKit from "npm:terminal-kit";

const term = terminalKit.terminal;
const socketUrl = "wss://websockets.tiltify.com/socket/websocket?vsn=2.0.0"; // <-- Change this
const logFile = "./messages.log";
const graphFile = "./graph.log";
const maxMessagesToShow = 5;

let totalMessages = 0;
const messageBuffer: string[] = [];

function updateDisplay() {
  term.clear();
  term.moveTo(1, 1, `Total messages received: ${totalMessages}\n\n`);
  term(`Last ${maxMessagesToShow} messages:\n`);
  const messagesToShow = messageBuffer.slice(-maxMessagesToShow);
  messagesToShow.forEach((msg, idx) => {
    term(`${idx + 1}. ${msg}\n`);
  });
}

function logMessageToFile(message: string) {
  const logEntry = `[${new Date().toISOString()}] ${message}\n`;
  Deno.writeTextFile(logFile, logEntry, { append: true });
}

function logRaisedAmount(amount: number) {
  const logEntry = `[${new Date().toISOString()}] ${amount}\n`;
  Deno.writeTextFile(graphFile, logEntry, { append: true });
}

function parseMessage(message: string) {
  try {
    const parsed = JSON.parse(message);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const type = parsed[3];
      if (type === "reward") {
        term.green(`Reward message received: ${JSON.stringify(parsed)}\n`);
      } else if (type === "fact") {
        term.blue(`Fact message received: ${JSON.stringify(parsed)}\n`);
        let factData = parsed[4];
        let totalAmountRaised = factData?.totalAmountRaised
        if (!totalAmountRaised) {
            term.red("No totalAmountRaised found in fact data.\n");
            return;
        }
        term.blue(`Total amount raised: $${totalAmountRaised}\n`);
        // match with $100.00
        let parsedAmount = parseInt(totalAmountRaised);
        logRaisedAmount(parsedAmount);
      } else {
        term.yellow(`Other message type: ${type}\n`);
      }
    } else {
      term.red(`Unexpected message format: ${message}\n`);
    }
  } catch (e: any) {
    term.red(`Error parsing message: ${e.message}\n`);
  }
}

function connectWebSocket() {
  const ws = new WebSocket(socketUrl);

  let heartbeatInterval: number | null = null;

  ws.onopen = () => {
    term.green(`Connected to WebSocket at ${socketUrl}\n`);
    // ["3", "3", "fact.0478358a-c4ff-4ab0-9cc7-5f0b328df9dc.fact", "phx_join", {}]
    ws.send(JSON.stringify([
        "3",
        "3",
        "fact.0478358a-c4ff-4ab0-9cc7-5f0b328df9dc.fact",
        "phx_join",
        {}
    ]));
    ws.send(JSON.stringify([
        "6",
        "6",
        "fact.0478358a-c4ff-4ab0-9cc7-5f0b328df9dc.reward",
        "phx_join",
        {}
    ]));
    term.green("Sent join message.\n");
    // [null,"7","phoenix","heartbeat",{}]
    heartbeatInterval = setInterval(() => {
        ws.send(JSON.stringify([null, "7", "phoenix", "heartbeat", {}]));
        term.green("Sent heartbeat.\n");
    }, 30000); // Send heartbeat every 30 seconds

  };

  ws.onmessage = (event) => {
    const msg = event.data;
    totalMessages++;
    messageBuffer.push(msg);
    updateDisplay();
    logMessageToFile(msg);
    parseMessage(msg);
  };

  ws.onerror = (err) => {
    term.red(`WebSocket error: ${JSON.stringify(err)}\n`);
  };

  ws.onclose = () => {
    term.red("\nWebSocket connection closed.\n");
    ws.close();
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    setTimeout(() => {
      term.yellow("Reconnecting to WebSocket...\n");
      connectWebSocket(); // Attempt to reconnect
    }, 10);
  };
}

connectWebSocket();
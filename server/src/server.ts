import log from "./log";
import * as fs from "fs";

type ServerCapabilities = Record<string, unknown>;
type RequestMethod = (
  message: RequestMessage
) => ReturnType<typeof initialize> | ReturnType<typeof completion>;
type DocumentUri = string;
type DocumentBody = string;
type NotificationMethod = (message: NotificationMessage) => void;

const documents = new Map<DocumentUri, DocumentBody>();
const words = fs.readFileSync("D:/words.txt", "utf-8").toString().split("\n");

interface Message {
  jsonrpc: string;
}

interface NotificationMessage extends Message {
  method: string;
  params: unknown[] | object;
}

interface RequestMessage extends NotificationMessage {
  id: number | string;
}

interface ResponseMessage extends Message {
  id: number | string | null;
  result?: string | number | boolean | unknown[] | object | null;
  // error?: ResponseError;
}

interface InitializeResult {
  capabilities: ServerCapabilities;
  serverInfo?: {
    name: string;
    version?: string;
  };
}

interface CompletionItem {
  label: string;
}

interface CompletionList {
  isIncomplete: boolean;
  items: CompletionItem[];
}

interface TextDocumentIdentifier {
  uri: DocumentUri;
}

interface VersionedTextDocumentIdentifier extends TextDocumentIdentifier {
  version: number;
}

interface TextDocumentContentChangeEvent {
  text: string;
}

interface DidChangeTextDocumentParams {
  textDocument: VersionedTextDocumentIdentifier;
  contentChanges: TextDocumentContentChangeEvent[];
}

interface Position {
  line: number;
  character: number;
}

interface TextDocumentPositionParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}

interface CompletionParams extends TextDocumentPositionParams {}

const initialize = (message: RequestMessage): InitializeResult => {
  return {
    capabilities: {
      completionProvider: {},
      textDocumentSync: 1,
    },
    serverInfo: {
      name: "lsp-nangosha",
      version: "0.0.1",
    },
  };
};

const completion = (message: RequestMessage): CompletionList | null => {
  const params = message.params as CompletionParams;
  const content = documents.get(params.textDocument.uri);

  if (!content) {
    return null;
  }

  const currentLine = content.split("\n")[params.position.line];
  const lineUntilCursor = currentLine.slice(0, params.position.character);
  const currentPrefix = lineUntilCursor.replace(/.*\W(.*?)/, "$1");

  const items = words
    .filter((word) => {
      return word.startsWith(currentPrefix);
    })
    .slice(0, 1000)
    .map((word) => {
      return { label: word };
    });

  return {
    isIncomplete: true,
    items,
  };
};

const didChange = (message: NotificationMessage) => {
  log.write({ message })

  const params = message.params as DidChangeTextDocumentParams;
  log.write({ params })
  documents.set(params.textDocument.uri, params.contentChanges[0].text);
};

// the way that the LSP works is with methods, so
// define methods for the different server/client capabilities
const methodLookup: Record<string, RequestMethod | NotificationMethod> = {
  initialize,
  "textDocument/didChange": didChange,
  "textDocument/completion": completion,
};

const respond = (id: RequestMessage["id"], result: object | null) => {
  const message = JSON.stringify({ id, result });
  const messageLength = Buffer.byteLength(message, "utf8");
  const header = `Content-Length: ${messageLength}\r\n\r\n`;

  // log.write(header + message);
  process.stdout.write(header + message);
};

let buffer = "";
process.stdin.on("data", (data) => {
  buffer += data;

  while (true) {
    // check for the Content_Length line
    const lengthMatch = buffer.match(/Content-Length: (\d+)\r\n/);
    if (!lengthMatch) break;

    const contentLength = parseInt(lengthMatch[1], 10);
    const messageStart = buffer.indexOf("\r\n\r\n") + 4;

    // continue unless the full message is in the buffer
    if (buffer.length < messageStart + contentLength) break;

    const rawMessage = buffer.slice(messageStart, messageStart + contentLength);
    const message = JSON.parse(rawMessage);

    // log.write({
    //   id: message.id,
    //   method: message.method,
    // });

    // call method and respond
    const method = methodLookup[message.method];

    if (method) {
      const result = method(message);

      if (result !== undefined) {
        respond(message.id, result);
      }
    }

    // remove the processed message from the buffer
    buffer = buffer.slice(messageStart + contentLength);
  }
});

import log from "./log";
import * as fs from "fs";
import { spawnSync } from "child_process";
import {
  CodeAction,
  CodeActionKind,
  CodeActionParams,
  CompletionList,
  CompletionParams,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeTextDocumentParams,
  DocumentBody,
  DocumentDiagnosticParams,
  DocumentUri,
  FullDocumentDiagnosticReport,
  InitializeResult,
  NotificationMessage,
  NotificationMethod,
  RequestMessage,
  RequestMethod,
} from "./types";

const MAX_LENGTH = 1000;
const documents = new Map<DocumentUri, DocumentBody>();
const words = fs
  .readFileSync("/home/nangoshamsg6/words.txt", "utf-8")
  .toString()
  .split("\r\n");

export const initialize = (message: RequestMessage): InitializeResult => {
  return {
    capabilities: {
      completionProvider: {},
      codeActionProvider: true,
      textDocumentSync: 1,
      diagnosticProvider: {
        identifier: "nangoshaDiagnosticProviderIdentifer",
        interfaceFileDependencies: false,
        workspaceDiagnostics: false,
      },
    },
    serverInfo: {
      name: "lsp-nangosha",
      version: "0.0.1",
    },
  };
};

export const completion = (message: RequestMessage): CompletionList | null => {
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
    .slice(0, MAX_LENGTH)
    .map((word) => {
      return { label: word };
    });

  return {
    isIncomplete: items.length === MAX_LENGTH,
    items,
  };
};

const spellingSuggestions = (content: string): Record<string, string[]> => {
  const invalidWordsAndSuggestions: Record<string, string[]> = {};
  const allOutput = spawnSync("aspell", ["pipe"], {
    input: content,
    encoding: "utf-8",
  })
    .stdout.trim()
    .split("\n");

  allOutput.forEach((line) => {
    const prefix = line.slice(0, 1);
    switch (prefix) {
      case "&":
        const match = line.match(/^& (.*?) \d.*: (.*)$/);

        if (!match) return;

        invalidWordsAndSuggestions[match[1]] = match[2].split(", ");
        break;
      case "#":
        const noSuggestionMatch = line.match(/^# (.*?) \d/);

        if (!noSuggestionMatch) return;

        invalidWordsAndSuggestions[noSuggestionMatch[1]] = [];
        break;
    }
  });

  return invalidWordsAndSuggestions;
};

export const didChange = (message: NotificationMessage) => {
  const params = message.params as DidChangeTextDocumentParams;
  documents.set(params.textDocument.uri, params.contentChanges[0].text);
};

export const codeAction = (params: CodeActionParams): CodeAction[] => {
  const inner_params = params as any;
  const diagnostics = inner_params.params.context.diagnostics;

  return diagnostics.flatMap((diagnostic: any): CodeAction[] => {
    return diagnostic.data.wordSuggestions.map((wordSuggestion: any): CodeAction => {
      return {
        title: `Replace with "${wordSuggestion}"`,
        kind: CodeActionKind.QuickFix,
        edit: {
          changes: {
            [inner_params.params.textDocument.uri]: [
              {
                range: diagnostic.range,
                newText: wordSuggestion,
              },
            ],
          },
        },
      };
    });

  });
};

export const diagnostic = (
  params: DocumentDiagnosticParams
): FullDocumentDiagnosticReport | null => {
  // the funny thing is that everytime i give the parameters a type of
  // DocumentDiagnosticParams, i just get errors. I don't know why
  // In the meantime, I will use the cast the any type and work with them as is
  const inner_params = params as any;
  const fileChanges = documents.get(inner_params.params.textDocument.uri);

  log.write({ fileChanges });

  if (!fileChanges) {
    return null;
  }

  const fileChangesArr = fileChanges.split("\n");
  const wordsInDocument = fileChanges.split(/\W/);
  const invalidWords = wordsInDocument.filter((word) => !words.includes(word));

  const invalidWordsAndSuggestions: Record<string, string[]> =
    spellingSuggestions(fileChanges);
  log.write({ invalidWordsAndSuggestions });

  const items: Diagnostic[] = [];
  Object.keys(invalidWordsAndSuggestions).forEach(invalidWord => {
    const invalidWordRegex = new RegExp(`\\b${invalidWord}\\b`, "g");
    const wordSuggestions = invalidWordsAndSuggestions[invalidWord]

    let message = wordSuggestions.length ? `${invalidWord} not in our dictionary. Did you mean: ${wordSuggestions.join(", ")}` : `${invalidWord} is not our dictionary`

    fileChangesArr.forEach((value, index) => {
      let match;

      while ((match = invalidWordRegex.exec(value)) !== null) {
        items.push({
          source: "ns-lint",
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: index, character: match.index },
            end: { line: index, character: match.index + invalidWord.length },
          },
          message,
          data: {
            wordSuggestions,
            invalidWord,
            type: "spelling-suggestion",
          },
        });
      }
    });
  });

  return {
    kind: "full",
    items,
  };
};

const methodLookup: Record<
  string,
  RequestMethod | NotificationMethod | typeof diagnostic | typeof codeAction
> = {
  initialize,
  "textDocument/didChange": didChange,
  "textDocument/completion": completion,
  "textDocument/codeAction": codeAction,
  "textDocument/diagnostic": diagnostic,
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

    log.write({
      id: message.id,
      method: message.method,
    });

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

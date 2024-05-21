import { codeAction, completion, initialize } from "./server";

export type ServerCapabilities = Record<string, unknown>;
export type RequestMethod = (
  message: RequestMessage
) =>
  | ReturnType<typeof initialize>
  | ReturnType<typeof completion>
  | ReturnType<typeof codeAction>;
export type DocumentUri = string;
export type DocumentBody = string;
export type NotificationMethod = (message: NotificationMessage) => void;
export type CodeActionMethod = (params: CodeActionParams) => unknown;
export type ProgressToken = number | string;

export interface Message {
  jsonrpc: string;
}

export interface NotificationMessage extends Message {
  method: string;
  params: unknown[] | object;
}

export interface RequestMessage extends NotificationMessage {
  id: number | string;
}

export interface ResponseMessage extends Message {
  id: number | string | null;
  result?: string | number | boolean | unknown[] | object | null;
  // error?: ResponseError;
}

export interface InitializeResult {
  capabilities: ServerCapabilities;
  serverInfo?: {
    name: string;
    version?: string;
  };
}

export interface CompletionItem {
  label: string;
}

export interface CompletionList {
  isIncomplete: boolean;
  items: CompletionItem[];
}

export interface TextDocumentIdentifier {
  uri: DocumentUri;
}

export interface VersionedTextDocumentIdentifier
  extends TextDocumentIdentifier {
  version: number;
}

export interface TextDocumentContentChangeEvent {
  text: string;
}

export interface DidChangeTextDocumentParams {
  textDocument: VersionedTextDocumentIdentifier;
  contentChanges: TextDocumentContentChangeEvent[];
}

export interface Position {
  line: number;
  character: number;
}

export interface TextDocumentPositionParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Diagnostic {
  range: Range;
  severity?: DiagnosticSeverity;
  message: string;
  source?: string;
}

export namespace DiagnosticSeverity {
  export const Error: 1 = 1;
  export const Warning: 2 = 2;
  export const Information: 3 = 3;
  export const Hint: 4 = 4;
}

export type DiagnosticSeverity = 1 | 2 | 3 | 4;

export interface CompletionParams extends TextDocumentPositionParams {}

export interface WorkDoneProgressParams {
  workDoneToken?: ProgressToken;
}

export interface CodeActionParams extends WorkDoneProgressParams {
  textDocument: TextDocumentIdentifier;
  range: Range;
  context: CodeActionContext;
}

export interface CodeActionContext {
  diagnostics: Diagnostic[];
}

export type CodeActionKind = string;

export namespace CodeActionKind {
  export const QuickFix: CodeActionKind = "quickfix";
}

export interface CodeAction {
  title: string;
  kind?: CodeActionKind;
  diagnostics?: Diagnostic[];
}

export interface WorkDoneProgressOptions {
  workDoneProgress?: boolean;
}

export interface DiagnosticOptions extends WorkDoneProgressOptions {
  identifier?: string;
  interFileDependencies: false;
  workspaceDiagnostics: false;
}

export namespace DocumentDiagnosticReportKind {
  export const Full = "full";
}

export type DocumentDiagnosticReportKind = "full" | "unchanged";

export interface DocumentDiagnosticParams extends WorkDoneProgressParams {
  textDocument: TextDocumentIdentifier;
}

export interface FullDocumentDiagnosticReport {
  kind: "full"; // should we be hardcoding this?
  items: Diagnostic[];
}

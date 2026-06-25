import {
  parseDsmlToolCalls,
  stripDsmlToolMarkup,
  type ParsedDsmlToolCall,
} from "@/lib/muthur-core/parse-dsml-tool-calls";
import { parseXmlToolCalls, stripXmlToolMarkup } from "@/lib/muthur-core/parse-xml-tool-calls";
import { parseProseToolCalls, stripProseToolMarkup } from "@/lib/muthur-core/parse-prose-tool-calls";

export type ParsedInlineToolCall = ParsedDsmlToolCall;

export function stripInlineToolMarkup(text: string): string {
  return stripProseToolMarkup(stripXmlToolMarkup(stripDsmlToolMarkup(text)));
}

/** Parse tool calls embedded in assistant content (DSML, XML, or prose localfs calls). */
export function parseInlineToolCalls(text: string): ParsedInlineToolCall[] {
  const dsml = parseDsmlToolCalls(text);
  if (dsml.length > 0) return dsml;
  const xml = parseXmlToolCalls(text);
  if (xml.length > 0) return xml;
  return parseProseToolCalls(text);
}

export function inlineCallsToOpenAiToolCalls(
  calls: ParsedInlineToolCall[],
  idPrefix = "inline",
): Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> {
  const stamp = Date.now();
  return calls.map((call, index) => ({
    id: `${idPrefix}_${stamp}_${index}`,
    type: "function" as const,
    function: {
      name: call.name,
      arguments: JSON.stringify(call.args),
    },
  }));
}

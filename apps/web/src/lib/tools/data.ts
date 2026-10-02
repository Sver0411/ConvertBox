import {parse,printParseErrorCode,type ParseError} from "jsonc-parser";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export const MAX_TEXT_BYTES = 8 * 1024 * 1024;

export function parseJson(text: string): unknown {
  const errors: ParseError[] = [];
  const value = parse(text, errors, {disallowComments:true,allowTrailingComma:false,allowEmptyContent:false});
  if (errors.length) {
    const before=text.slice(0,errors[0].offset);
    throw new Error(`JSON: ${before.split("\n").length}:${errors[0].offset-before.lastIndexOf("\n")} — ${printParseErrorCode(errors[0].error)}`);
  }
  return value;
}

export function parseCsv(text: string, delimiter=","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false, afterQuote = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') { value += '"'; index++; }
        else { quoted = false; afterQuote = true; }
      } else value += char;
      continue;
    }
    if (char === '"' && value === "" && !afterQuote) { quoted = true; continue; }
    if (char === delimiter) { row.push(value); value = ""; afterQuote = false; continue; }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(value); rows.push(row); row = []; value = ""; afterQuote = false; continue;
    }
    if (afterQuote || char === '"') throw new Error("CSV contains an invalid quoted field.");
    value += char;
  }
  if (quoted) throw new Error("CSV has an unclosed quote.");
  if (value || row.length || afterQuote) { row.push(value); rows.push(row); }
  return rows;
}

export function csvToJson(text: string,delimiter=",",hasHeader=true): unknown[] {
  const parsed=parseCsv(text,delimiter);
  const headers=hasHeader?parsed[0]:parsed[0]?.map((_,i)=>`column_${i+1}`), rows=hasHeader?parsed.slice(1):parsed;
  if (!headers?.length || headers.some(key => !key.trim()) || new Set(headers).size !== headers.length) throw new Error("CSV headers must be non-empty and unique.");
  if (rows.some(row => row.length !== headers.length)) throw new Error("CSV rows must have the same number of columns as the header.");
  return rows.map(row => Object.fromEntries(headers.map((key, index) => [key, row[index]])));
}

export function jsonToCsv(value: unknown,columns="",flatten=false): string {
  if (!Array.isArray(value) || !value.length || value.some(row => !row || typeof row !== "object" || Array.isArray(row))) throw new Error("JSON must be a non-empty array of flat objects.");
  let rows = value as Record<string, unknown>[];
  if(flatten){const expand=(item:Record<string,unknown>,prefix=''):Record<string,unknown>=>Object.fromEntries(Object.entries(item).flatMap(([key,v])=>v&&typeof v==='object'&&!Array.isArray(v)?Object.entries(expand(v as Record<string,unknown>,prefix+key+'.')):[[prefix+key,Array.isArray(v)?JSON.stringify(v):v]]));rows=rows.map(row=>expand(row));}
  const keys = columns.trim()?columns.split(",").map(key=>key.trim()):[...new Set(rows.flatMap(row => Object.keys(row)))];
  if (rows.some(row => Object.values(row).some(item => item !== null && typeof item === "object"))) throw new Error("Nested JSON is not supported. Flatten the objects first.");
  const escape = (item: unknown) => {
    let text = item === null || item === undefined ? "" : String(item);
    // Protect spreadsheet applications from interpreting data as formulas.
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [keys.map(escape).join(","), ...rows.map(row => keys.map(key => escape(row[key])).join(","))].join("\r\n");
}

export function transformData(toolId: string, text: string, indent: string = "2",options:{delimiter?:string;header?:boolean;flatten?:boolean;columns?:string}={}): string {
  if (new TextEncoder().encode(text).byteLength > MAX_TEXT_BYTES) throw new Error("Text input exceeds 8 MB.");
  if (toolId === "data.csv-json") return JSON.stringify(csvToJson(text,options.delimiter==="tab"?"\t":options.delimiter??",",options.header!==false), null, 2);
  if (toolId === "data.yaml-json") {
    const value=parseYaml(text, {maxAliasCount:0,uniqueKeys:true});
    const check=(item:unknown):void=>{if(typeof item==='number'&&!Number.isFinite(item))throw new Error('Non-finite YAML numbers are not supported by JSON.');if(item&&typeof item==='object'){if(!Array.isArray(item)&&Object.getPrototypeOf(item)!==Object.prototype&&Object.getPrototypeOf(item)!==null)throw new Error('YAML value cannot be represented as JSON.');for(const child of Object.values(item))check(child);}};
    check(value);return JSON.stringify(value,null,2);
  }
  const value = parseJson(text);
  switch (toolId) {
    case "data.json-format": return JSON.stringify(value, null, indent === "tab" ? "\t" : Number(indent) === 4 ? 4 : 2);
    case "data.json-minify": return JSON.stringify(value);
    case "data.json-validate": return "JSON valid";
    case "data.json-csv": return jsonToCsv(value,options.columns,options.flatten);
    case "data.json-yaml": return stringifyYaml(value);
    default: throw new Error("Unknown data tool.");
  }
}

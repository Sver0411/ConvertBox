const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {toolRegistry}=require('../apps/web/src/lib/tools/registry.ts');
const contents='# Tool Catalog\n\nGenerated from the frontend Tool Registry. Run `npm run generate-tool-docs` after changes. Server tools are shown only when the running server advertises them.\n\n| ID | 中文 | English | Inputs | Result | Processing | Resource |\n|---|---|---|---|---|---|---|\n'+toolRegistry.map(tool=>`| ${tool.id} | ${tool.name.zh} | ${tool.name.en} | ${tool.acceptedInputs.join(', ')} | ${tool.outputKind} | ${tool.processing} | ${tool.estimatedResourceClass} |`).join('\n')+'\n';
const target=path.resolve(__dirname,'../docs/TOOLS.md');
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==contents)throw new Error('Tool catalog is stale');}else fs.writeFileSync(target,contents);
console.log(`${toolRegistry.length} tools documented`);

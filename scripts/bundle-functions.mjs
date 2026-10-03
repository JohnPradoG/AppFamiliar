// Junta cada Edge Function (index + handler + _shared) en UN archivo, para pegarlo en el editor del panel de Supabase
// (Edge Functions → Deploy a new function → Via Editor) sin instalar la CLI. Salida: supabase/bundled/<nombre>.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const FUNCS = ['invite-member', 'accept-invite'];
const read = (p) => readFileSync(p, 'utf8');
const dropLocalImports = (src) => src.replace(/^import[^;]*from '\.{1,2}\/[^']*';\n/gm, '');

mkdirSync('supabase/bundled', { recursive: true });
for (const name of FUNCS) {
  const dir = `supabase/functions/${name}`;
  const index = read(`${dir}/index.ts`);
  const npmImports = index.match(/^import[^;]*from 'npm:[^']*';\n/gm) ?? [];
  const body = [
    read('supabase/functions/_shared/token.ts'),
    dropLocalImports(read(`${dir}/handler.ts`)),
    dropLocalImports(index).replace(/^import[^;]*from 'npm:[^']*';\n/gm, ''),
  ].join('\n');
  const out = `// ${name} — archivo único para el editor de Supabase. GENERADO por scripts/bundle-functions.mjs: no editar a mano.\n${npmImports.join('')}\n${body}`;
  writeFileSync(`supabase/bundled/${name}.ts`, out);
  console.log(`supabase/bundled/${name}.ts (${out.split('\n').length} líneas)`);
}

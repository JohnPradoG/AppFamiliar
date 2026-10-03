const { chromium } = require('playwright-core');
// Recorre la app web contra un Supabase simulado y falla si hay errores de consola o no se puede tocar algún botón.
const S = process.env.SHOT_DIR || __dirname;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--host-resolver-rules=MAP localhost 127.0.0.1'] });
  const errors = [];
  async function session(email, tag, steps) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text().slice(0, 200)}`); });
    await p.goto('http://localhost:8099/'); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${S}/${tag}-0-login.png` });
    await p.getByPlaceholder('Correo').fill(email);
    await p.getByPlaceholder('Contraseña').fill('clave12345');
    await p.getByText('Entrar', { exact: true }).click(); await p.waitForTimeout(2500);
    await p.screenshot({ path: `${S}/${tag}-1-home.png` });
    let i = 2;
    for (const [label, name] of steps) {
      try { await p.getByText(label, { exact: true }).last().click({ timeout: 4000 }); await p.waitForTimeout(1500); await p.screenshot({ path: `${S}/${tag}-${i++}-${name}.png` }); }
      catch (e) { errors.push(`[${tag}] no pude tocar "${label}": ${e.message.split('\n')[0]}`); }
    }
    await ctx.close();
  }
  await session('mama@t', 'mama', [['Cuentas', 'cuentas'], ['Ingresos', 'ingresos'], ['Registrar ingreso de máquina', 'nuevo-ingreso'], ['Más', 'mas']]);
  await session('john@t', 'john', [['Historial', 'historial'], ['Más', 'mas']]);
  await b.close();
  console.log(errors.length ? errors.join('\n') : 'recorrido completo: sin errores');
  process.exit(errors.length ? 1 : 0);
})();

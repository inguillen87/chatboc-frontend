import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

const outputPath = resolve(process.cwd(), 'public/images/og-tdf-discapacidad.png');

const html = String.raw`<!doctype html>
<html lang="es-AR">
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      html, body { width: 1200px; height: 630px; margin: 0; overflow: hidden; }
      body {
        font-family: "Segoe UI", Arial, sans-serif;
        color: #143b38;
        background:
          radial-gradient(circle at 8% 4%, rgba(132, 211, 197, .42), transparent 30%),
          radial-gradient(circle at 88% 92%, rgba(225, 202, 139, .32), transparent 28%),
          #f3f7f5;
      }
      .canvas { position: relative; display: grid; grid-template-columns: 492px 1fr; gap: 36px; width: 100%; height: 100%; padding: 42px 46px 38px; }
      .left { display: flex; min-width: 0; flex-direction: column; }
      .kicker { display: inline-flex; width: fit-content; align-items: center; gap: 9px; padding: 8px 12px; border: 1px solid #9fc6bd; border-radius: 999px; background: rgba(255,255,255,.76); color: #08675f; font-size: 13px; font-weight: 800; letter-spacing: .06em; }
      .kicker-dot { width: 9px; height: 9px; border-radius: 50%; background: #11a594; box-shadow: 0 0 0 5px rgba(17,165,148,.12); }
      h1 { margin: 24px 0 0; max-width: 480px; color: #102f2e; font-size: 46px; line-height: 1.02; letter-spacing: -.045em; font-weight: 720; }
      .lead { margin: 20px 0 0; max-width: 462px; color: #4c625e; font-size: 18px; line-height: 1.46; }
      .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 22px; }
      .chip { padding: 8px 11px; border: 1px solid #c6d7d2; border-radius: 10px; background: rgba(255,255,255,.9); color: #315550; font-size: 13px; font-weight: 700; }
      .author { margin-top: auto; padding-top: 16px; border-top: 1px solid #cad9d4; color: #315550; font-size: 12px; line-height: 1.45; }
      .author strong { display: block; color: #173f3b; font-size: 14px; }
      .stage { position: relative; min-width: 0; align-self: center; padding: 12px; border: 1px solid rgba(143,186,177,.82); border-radius: 30px; background: rgba(255,255,255,.8); box-shadow: 0 34px 90px rgba(16,61,57,.18); }
      .window { height: 498px; overflow: hidden; border-radius: 21px; background: #fff; }
      .window-bar { display: flex; height: 57px; align-items: center; justify-content: space-between; padding: 0 18px; border-bottom: 1px solid #d8e3df; background: #f8faf9; }
      .program { display: flex; align-items: center; gap: 10px; color: #173b38; font-size: 15px; font-weight: 800; }
      .mark { display: grid; width: 32px; height: 32px; place-items: center; border-radius: 10px; background: #0b4b47; color: #fff; font-size: 18px; }
      .sample { padding: 7px 10px; border-radius: 999px; background: #e5f4ef; color: #087066; font-size: 11px; font-weight: 800; }
      .workspace { display: grid; grid-template-columns: 248px 1fr; height: 441px; }
      .phone { background: #edf4f1; border-right: 1px solid #cad9d4; }
      .phone-head { display: flex; height: 52px; align-items: center; justify-content: space-between; padding: 0 14px; background: #0b4b47; color: #fff; }
      .phone-head strong { display: block; font-size: 12px; }
      .phone-head span { color: rgba(255,255,255,.72); font-size: 10px; }
      .messages { display: flex; flex-direction: column; gap: 10px; padding: 15px; }
      .bubble { max-width: 90%; padding: 10px 11px; border-radius: 13px; background: #fff; color: #284b47; font-size: 11px; line-height: 1.45; box-shadow: 0 4px 12px rgba(21,67,62,.08); }
      .bubble.me { align-self: flex-end; border-bottom-right-radius: 4px; background: #d8f5dc; }
      .audio { display: grid; grid-template-columns: 31px 1fr; align-items: center; gap: 8px; }
      .play { display: grid; width: 31px; height: 31px; place-items: center; border-radius: 50%; background: #0b5f58; color: #fff; font-size: 13px; }
      .wave { color: #3d8179; font-size: 14px; letter-spacing: 1px; }
      .asset { display: flex; align-items: center; gap: 8px; margin-top: 9px; padding: 8px; border: 1px solid #c9d9d4; border-radius: 9px; background: #fff; font-size: 10px; font-weight: 700; }
      .crm { min-width: 0; padding: 15px; background: #102d2c; color: #fff; }
      .crm-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .crm-title small { display: block; color: #7dd6c9; font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      .crm-title strong { display: block; margin-top: 3px; font-size: 15px; }
      .case { flex: 0 0 auto; padding: 6px 9px; border: 1px solid rgba(255,255,255,.14); border-radius: 999px; color: rgba(255,255,255,.8); font-size: 10px; font-weight: 700; }
      .inbox { margin-top: 12px; padding: 11px; border: 1px solid rgba(255,255,255,.1); border-radius: 11px; background: rgba(0,0,0,.12); }
      .inbox-top { display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-weight: 800; }
      .inbox-top span { color: rgba(255,255,255,.58); font-size: 9px; }
      .filters { display: flex; gap: 5px; margin-top: 8px; }
      .filter { padding: 5px 7px; border-radius: 999px; background: rgba(255,255,255,.08); color: rgba(255,255,255,.72); font-size: 9px; font-weight: 700; }
      .filter.risk { background: rgba(240,201,111,.14); color: #f5d994; }
      .tabs { display: flex; gap: 4px; margin-top: 10px; padding: 4px; border-radius: 9px; background: rgba(0,0,0,.12); }
      .tab { padding: 6px 7px; border-radius: 7px; color: rgba(255,255,255,.64); font-size: 9px; font-weight: 700; }
      .tab.active { background: #7dd6c9; color: #073c38; }
      .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px; margin-top: 10px; }
      .metric { min-width: 0; padding: 9px; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: rgba(255,255,255,.045); }
      .metric span { display: block; color: rgba(255,255,255,.5); font-size: 8px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .metric strong { display: block; margin-top: 4px; overflow: hidden; color: rgba(255,255,255,.92); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
      .next { margin-top: 10px; padding: 11px; border: 1px solid rgba(61,181,165,.3); border-radius: 10px; background: #123e3a; }
      .next span { color: #8be0d3; font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .next p { margin: 5px 0 0; color: rgba(255,255,255,.82); font-size: 10px; line-height: 1.4; }
      .truth { position: absolute; right: 22px; bottom: 18px; padding: 7px 10px; border-radius: 999px; background: rgba(16,47,46,.9); color: #fff; font-size: 10px; font-weight: 700; }
    </style>
  </head>
  <body>
    <main class="canvas">
      <section class="left">
        <div class="kicker"><span class="kicker-dot"></span> PROPUESTA EJECUTIVA · TIERRA DEL FUEGO</div>
        <h1>Una puerta de entrada accesible para discapacidad</h1>
        <p class="lead">WhatsApp y un CRM operativo trabajan sobre el mismo caso para orientar, derivar y acompañar sin volver a empezar.</p>
        <div class="chips">
          <span class="chip">WhatsApp + CRM</span>
          <span class="chip">Atención humana</span>
          <span class="chip">iPhone + Android</span>
          <span class="chip">Marca blanca</span>
        </div>
        <div class="author">
          <strong>Hecho por Marcelo Guillén</strong>
          Ingeniero en Informática y Telecomunicaciones · fundador y CEO de Inmovar Latam
        </div>
      </section>
      <section class="stage" aria-label="Vista de WhatsApp y CRM">
        <div class="window">
          <header class="window-bar">
            <div class="program"><span class="mark">♿</span> Mesa Única de Discapacidad</div>
            <span class="sample">MUESTRA NAVEGABLE</span>
          </header>
          <div class="workspace">
            <div class="phone">
              <div class="phone-head"><div><strong>Agente de IA</strong><span>WhatsApp accesible</span></div><b>•••</b></div>
              <div class="messages">
                <div class="bubble">Hola. Puedo orientarte con CUD, RUPE, salud, educación o empleo. ¿Para quién es la consulta?</div>
                <div class="bubble me">Necesito saber qué documentación llevar para renovar el CUD.</div>
                <div class="bubble me audio"><span class="play">▶</span><span><b>Nota de voz · 00:24</b><br><span class="wave">▂▅▃▇▄▆▂▅</span></span></div>
                <div class="bubble">Te preparo una lista orientativa y, si querés, la derivación a una persona.</div>
                <div class="asset">▣ Guía PDF + formulario &nbsp; →</div>
              </div>
            </div>
            <div class="crm">
              <div class="crm-title"><div><small>CRM de discapacidad</small><strong>Orientación CUD</strong></div><span class="case">DEMO-0142</span></div>
              <div class="inbox">
                <div class="inbox-top">Bandeja Mesa Única <span>12 casos de muestra</span></div>
                <div class="filters"><span class="filter">Pendientes 5</span><span class="filter risk">SLA en riesgo 3</span><span class="filter">Derivación 4</span></div>
              </div>
              <div class="tabs"><span class="tab active">Resumen</span><span class="tab">Persona</span><span class="tab">Trámite</span><span class="tab">Adjuntos</span></div>
              <div class="metrics">
                <div class="metric"><span>Cola</span><strong>Mesa Única</strong></div>
                <div class="metric"><span>Prioridad</span><strong>Media</strong></div>
                <div class="metric"><span>SLA</span><strong>1ª respuesta · 4 min</strong></div>
                <div class="metric"><span>Localidad</span><strong>Ushuaia · muestra</strong></div>
              </div>
              <div class="next"><span>Próximo paso</span><p>Validar la lista de cotejo y ofrecer transferencia humana con contexto protegido.</p></div>
            </div>
          </div>
        </div>
        <span class="truth">Datos representativos · sin información personal real</span>
      </section>
    </main>
  </body>
</html>`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: outputPath, type: 'png' });
  process.stdout.write(`${outputPath}\n`);
} finally {
  await browser.close();
}

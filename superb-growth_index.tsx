import { Hono } from "hono@4";
import { cors } from 'hono/cors';

const app = new Hono();
app.use("/*", cors());

const REPO = "albertomanuelcastrocastro-svg/palmero-bot-pytho";
const FILE_PATH = "signals_log.json";
const GH_TOKEN = Bun.env.GITHUB_TOKEN;

type Signal = {
  id: number;
  timestamp: string;
  simbolo: string;
  tipo: string;
  precio: string;
  tf: string;
  vol: string;
  sig4h: string;
  sig15m: string;
  decision: string | null;
  decisionTime: string | null;
};

// Lee el archivo de señales desde GitHub (sha incluido para poder actualizar)
async function loadSignals(): Promise<{ data: Signal[]; sha: string | null }> {
  try {
    const resp = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
      headers: { Authorization: `Bearer ${GH_TOKEN}`, "User-Agent": "palmero-bot", Accept: "application/vnd.github+json" }
    });
    if (resp.status === 404) return { data: [], sha: null };
    const json = await resp.json();
    const decoded = atob(json.content.replace(/\n/g, ""));
    const data = JSON.parse(decoded);
    return { data, sha: json.sha };
  } catch (e) {
    console.error("Error leyendo GitHub:", e);
    return { data: [], sha: null };
  }
}

// Guarda el archivo de señales en GitHub
async function saveSignals(data: Signal[], sha: string | null): Promise<void> {
  try {
    const content = btoa(JSON.stringify(data, null, 2));
    const body: any = {
      message: `Actualizar señales ${new Date().toISOString()}`,
      content,
    };
    if (sha) body.sha = sha;
    const resp = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${GH_TOKEN}`, "User-Agent": "palmero-bot", Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      console.error("Error guardando en GitHub:", await resp.text());
    }
  } catch (e) {
    console.error("Error guardando en GitHub:", e);
  }
}

app.get("/", (c) => c.text("PALMERO AGENT activo ✓"));
app.get("/api/health", (c) => c.json({ status: "ok" }));

app.post("/webhook", async (c) => {
  try {
    const body = await c.req.text();
    console.log("Señal recibida:", body);

    const partes = body.split("|");
    const simbolo   = partes[0] || "?";
    const direccion = partes[1] || "?";
    const precio    = partes[2] || "?";
    const tf        = partes[3] || "?";
    const vol       = partes[4] || "";
    const sig4h     = partes[5] || "";
    const sig15m    = partes[6] || "";

    const esLong = direccion.includes("LONG");
    const emoji  = esLong ? "🟢" : "🔴";
    const tipo   = esLong ? "GO LONG" : "GO SHORT";

    const { data, sha } = await loadSignals();
    const nextId = data.length > 0 ? Math.max(...data.map(s => s.id)) + 1 : 1;

    const signal: Signal = {
      id: nextId,
      timestamp: new Date().toISOString(),
      simbolo, tipo, precio, tf, vol, sig4h, sig15m,
      decision: null,
      decisionTime: null,
    };
    data.unshift(signal);
    if (data.length > 300) data.pop();
    await saveSignals(data, sha);

    const baseUrl = `https://${c.req.header("host")}`;
    const mensaje = `${emoji} *PALMERO 15 — ${tipo}*\n*${simbolo}* | TF: ${tf}\nPrecio: \`${precio}\`\n${vol}\n\n✅ Confluencia 15M + 5M + 1M alineados\n✅ Volumen gordo confirmado\n\n👉 *Decide y marca:*\n${baseUrl}/marcar?id=${signal.id}&d=entre\n${baseUrl}/marcar?id=${signal.id}&d=no`;

    const tgResp = await fetch(`https://api.telegram.org/bot${Bun.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: Bun.env.TELEGRAM_CHAT_ID,
        text: mensaje,
        parse_mode: "Markdown",
        disable_web_page_preview: true
      })
    });
    const tgJson = await tgResp.json();
    if (!tgJson.ok) {
      console.error("Error Telegram:", JSON.stringify(tgJson));
    } else {
      console.log("Telegram OK");
    }

    return c.json({ ok: true });
  } catch (e) {
    console.error("Error:", e);
    return c.json({ ok: false, error: String(e) }, 500);
  }
});

app.get("/marcar", async (c) => {
  const id = Number(c.req.query("id"));
  const decision = c.req.query("d");
  const { data, sha } = await loadSignals();
  const s = data.find(x => x.id === id);
  if (s) {
    s.decision = decision === "entre" ? "entre" : "no_entre";
    s.decisionTime = new Date().toISOString();
    await saveSignals(data, sha);
    return c.html(`<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#111;color:#fff;">
      <h2>${s.decision === "entre" ? "✅ Marcado: ENTRASTE" : "❌ Marcado: NO ENTRASTE"}</h2>
      <p>${s.simbolo} ${s.tipo} @ ${s.precio}</p>
      <p><a href="/panel" style="color:#4af;">Ver todas las señales</a></p>
    </body></html>`);
  }
  return c.html(`<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#111;color:#fff;"><h2>Señal no encontrada</h2></body></html>`);
});

app.get("/api/signals", async (c) => {
  const { data } = await loadSignals();
  return c.json(data);
});

app.get("/panel", async (c) => {
  const { data } = await loadSignals();
  const rows = data.slice(0, 50).map(s => {
    const fecha = new Date(s.timestamp).toLocaleString("es-ES", { timeZone: "Atlantic/Canary" });
    const color = s.tipo === "GO LONG" ? "#1abc4e" : "#e74c3c";
    let estado = "⏳ Pendiente";
    let botones = `
      <a href="/marcar?id=${s.id}&d=entre" style="background:#1abc4e;color:#fff;padding:6px 12px;border-radius:6px;text-decoration:none;margin-right:6px;">Entré</a>
      <a href="/marcar?id=${s.id}&d=no" style="background:#888;color:#fff;padding:6px 12px;border-radius:6px;text-decoration:none;">No entré</a>`;
    if (s.decision === "entre") { estado = "✅ Entraste"; botones = ""; }
    if (s.decision === "no_entre") { estado = "❌ No entraste"; botones = ""; }
    return `<tr>
      <td>${fecha}</td>
      <td style="color:${color};font-weight:bold;">${s.tipo}</td>
      <td>${s.simbolo}</td>
      <td>${s.tf}</td>
      <td>${s.precio}</td>
      <td>${estado}</td>
      <td>${botones}</td>
    </tr>`;
  }).join("");

  return c.html(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="font-family:sans-serif;background:#111;color:#eee;padding:10px;">
    <h2>📊 PALMERO 15 — Señales</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr style="background:#222;"><th>Hora</th><th>Tipo</th><th>Par</th><th>TF</th><th>Precio</th><th>Estado</th><th>Acción</th></tr>
      ${rows}
    </table>
  </body></html>`);
});

Bun.serve({ port: import.meta.env.PORT ?? 3000, fetch: app.fetch });

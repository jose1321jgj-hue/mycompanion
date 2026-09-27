import express from "express";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const db = new Database(path.join(__dirname, "mycompanion.db"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  personality TEXT DEFAULT '',
  appearance TEXT DEFAULT '',
  system_prompt TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

const count = db.prepare("SELECT COUNT(*) c FROM characters").get().c;
if (!count) {
  db.prepare(`INSERT INTO characters
    (name, personality, appearance, system_prompt)
    VALUES (?, ?, ?, ?)`).run(
      "Luna",
      "Cariñosa, divertida, atenta y cercana. Habla en español de forma natural.",
      "Mujer adulta ficticia, estilo realista, cabello largo y oscuro, apariencia elegante.",
      "Eres una compañera virtual ficticia adulta. Sé afectuosa, natural y respetuosa. No afirmes ser una persona real."
  );
}

app.get("/api/characters", (req, res) => {
  res.json(db.prepare("SELECT * FROM characters ORDER BY id").all());
});

app.post("/api/characters", (req, res) => {
  const { name, personality="", appearance="", system_prompt="" } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "Falta el nombre." });
  const info = db.prepare(`INSERT INTO characters
    (name, personality, appearance, system_prompt) VALUES (?, ?, ?, ?)`)
    .run(name.trim(), personality, appearance, system_prompt);
  res.json(db.prepare("SELECT * FROM characters WHERE id=?").get(info.lastInsertRowid));
});

app.get("/api/history/:id", (req, res) => {
  const rows = db.prepare(
    "SELECT id, role, content, created_at FROM messages WHERE character_id=? ORDER BY id"
  ).all(Number(req.params.id));
  res.json(rows);
});

app.get("/api/gallery/:id", (req, res) => {
  res.json(db.prepare(
    "SELECT id, prompt, url, created_at FROM images WHERE character_id=? ORDER BY id DESC"
  ).all(Number(req.params.id)));
});

function getCharacter(id) {
  return db.prepare("SELECT * FROM characters WHERE id=?").get(Number(id));
}

app.post("/api/chat", async (req, res) => {
  const { characterId, message } = req.body || {};
  const character = getCharacter(characterId);
  if (!character || !message?.trim()) return res.status(400).json({ error: "Datos incompletos." });

  db.prepare("INSERT INTO messages (character_id, role, content) VALUES (?, 'user', ?)")
    .run(character.id, message.trim());

  if (!process.env.AI_API_KEY || !process.env.AI_MODEL) {
    const fallback = `Estoy en modo demo. Conecta un modelo de IA en la configuración del servidor para que ${character.name} pueda responder de verdad.`;
    db.prepare("INSERT INTO messages (character_id, role, content) VALUES (?, 'assistant', ?)")
      .run(character.id, fallback);
    return res.json({ reply: fallback, demo: true });
  }

  const history = db.prepare(
    "SELECT role, content FROM messages WHERE character_id=? ORDER BY id DESC LIMIT 30"
  ).all(character.id).reverse();

  const system = [
    character.system_prompt,
    `Nombre del personaje: ${character.name}.`,
    `Personalidad: ${character.personality}.`,
    `Apariencia: ${character.appearance}.`,
    "Mantén continuidad con la conversación y responde en español salvo que el usuario pida otro idioma."
  ].filter(Boolean).join("\n");

  try {
    const r = await fetch(`${process.env.AI_BASE_URL || "https://openrouter.ai/api/v1"}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.AI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL,
        messages: [{ role: "system", content: system }, ...history],
        temperature: 0.85
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || `HTTP ${r.status}`);
    const reply = data?.choices?.[0]?.message?.content || "No recibí una respuesta.";
    db.prepare("INSERT INTO messages (character_id, role, content) VALUES (?, 'assistant', ?)")
      .run(character.id, reply);
    res.json({ reply });
  } catch (e) {
    res.status(502).json({ error: `No se pudo conectar al modelo: ${e.message}` });
  }
});

async function comfyGenerate(character, prompt) {
  const workflowPath = path.resolve(__dirname, process.env.COMFY_WORKFLOW || "./comfyui-workflow.example.json");
  const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
  const positiveId = String(process.env.COMFY_POSITIVE_NODE || "6");
  const negativeId = String(process.env.COMFY_NEGATIVE_NODE || "7");
  const saveId = String(process.env.COMFY_SAVE_NODE || "9");

  if (!workflow[positiveId] || !workflow[negativeId]) {
    throw new Error("Configura COMFY_POSITIVE_NODE y COMFY_NEGATIVE_NODE según tu workflow.");
  }

  const finalPrompt = [
    character.appearance,
    "Adult fictional character.",
    prompt
  ].filter(Boolean).join(", ");

  workflow[positiveId].inputs.text = finalPrompt;
  workflow[negativeId].inputs.text =
    "low quality, blurry, deformed, extra fingers, bad hands, duplicate person, watermark, text";

  const promptResp = await fetch(`${process.env.COMFY_URL || "http://127.0.0.1:8188"}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow, client_id: crypto.randomUUID() })
  });
  const promptData = await promptResp.json();
  if (!promptResp.ok || !promptData.prompt_id) {
    throw new Error(promptData?.error?.message || "ComfyUI rechazó el workflow.");
  }

  const id = promptData.prompt_id;
  const base = process.env.COMFY_URL || "http://127.0.0.1:8188";
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const h = await fetch(`${base}/history/${id}`);
    if (!h.ok) continue;
    const history = await h.json();
    const item = history[id];
    if (!item) continue;
    if (item.status?.status_str === "error") throw new Error("ComfyUI informó un error.");
    if (item.outputs) {
      for (const node of Object.values(item.outputs)) {
        for (const image of (node.images || [])) {
          const url = `${base}/view?filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder || "")}&type=${encodeURIComponent(image.type || "output")}`;
          return url;
        }
      }
    }
  }
  throw new Error("La generación tardó demasiado.");
}

app.post("/api/image", async (req, res) => {
  const { characterId, prompt } = req.body || {};
  const character = getCharacter(characterId);
  if (!character || !prompt?.trim()) return res.status(400).json({ error: "Datos incompletos." });
  try {
    const url = await comfyGenerate(character, prompt.trim());
    db.prepare("INSERT INTO images (character_id, prompt, url) VALUES (?, ?, ?)")
      .run(character.id, prompt.trim(), url);
    res.json({ url });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`MyCompanion v0.3 en http://localhost:${PORT}`));

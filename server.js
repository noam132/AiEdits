const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// Safe fetch: use native fetch (Node 18+) or fall back to node-fetch if installed.
// This prevents "fetch is not defined" crashes on older Node versions.
let fetchFn;
try {
    fetchFn = fetch; // Node 18+ native
    if (typeof fetchFn !== 'function') throw new Error();
} catch {
    fetchFn = require('node-fetch');
}

const app = express();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// --- API KEYS ---
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const CLAUDE_KEY = process.env.CLAUDE_API_KEY || "";
const GPT_KEY = process.env.GPT_API_KEY || "";

const SYSTEM_PROMPT = "You are AiEdits. Expert in Roblox Luau, Minecraft Skript, and Web Dev. Use triple backticks for code.";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const geminiModel = genAI.getGenerativeModel(
    { model: "gemini-2.5-flash", systemInstruction: SYSTEM_PROMPT },
    { apiVersion: 'v1beta' }
);

// --- HISTORY HELPERS ---
// Safely extract text from any history format (new { text } or old Gemini { parts } format)
function extractText(m) {
    if (typeof m.text === 'string') return m.text;
    if (typeof m.content === 'string') return m.content;
    if (m.parts?.[0]?.text) return m.parts[0].text;
    return "";
}

// Convert any history format → Claude / GPT format: { role: "user"|"assistant", content: string }
function toOpenAIHistory(history) {
    return history
        .map(m => ({
            role: (m.role === "model" || m.role === "assistant") ? "assistant" : "user",
            content: extractText(m)
        }))
        .filter(m => m.content); // drop blank entries
}

// Convert any history format → Gemini format: { role: "user"|"model", parts: [{ text }] }
function toGeminiHistory(history) {
    return history
        .map(m => ({
            role: (m.role === "assistant") ? "model" : m.role === "model" ? "model" : "user",
            parts: [{ text: extractText(m) }]
        }))
        .filter(m => m.parts[0].text); // drop blank entries
}

// --- STATUS ---
app.get('/status', (req, res) => res.send('AiEdits Server 2026 is Online'));

// --- MAIN CHAT ENDPOINT ---
app.post('/chat', upload.single('file'), async (req, res) => {
    try {
        let { message, history, selectedModel } = req.body;
        selectedModel = selectedModel || "gemini";

        console.log(`[${selectedModel.toUpperCase()}] Processing request...`);

        // Fail fast with a clear message if API key is missing
        if (selectedModel === "claude" && !CLAUDE_KEY) throw new Error("CLAUDE_API_KEY is not set in Render environment variables.");
        if (selectedModel === "gpt" && !GPT_KEY) throw new Error("GPT_API_KEY is not set in Render environment variables.");
        if (selectedModel === "gemini" && !GEMINI_KEY) throw new Error("GEMINI_API_KEY is not set in Render environment variables.");

        // Handle File Uploads
        if (req.file) {
            const fileContent = req.file.buffer.toString('utf8');
            message = `[FILE: ${req.file.originalname}]\n\n${fileContent}\n\n${message || ""}`;
        }

        // Parse history — works with any format the frontend sends
        let parsedHistory = [];
        if (history && history !== "[]") {
            try { parsedHistory = JSON.parse(history); } catch { parsedHistory = []; }
        }

        // --- GPT ---
        if (selectedModel === "gpt") {
            const messages = [
                { role: "system", content: SYSTEM_PROMPT },
                ...toOpenAIHistory(parsedHistory),
                { role: "user", content: message }
            ];

            const response = await fetchFn("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${GPT_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "gpt-4.1", // update to gpt-5.5 once it's available on your account
                    messages
                })
            });
            const data = await response.json();
            console.log('[GPT] status:', response.status, JSON.stringify(data).slice(0, 300));
            if (data.error) throw new Error(`OpenAI: ${data.error.message} (${data.error.type || 'unknown'})`);
            if (!data.choices?.[0]?.message?.content) throw new Error(`OpenAI unexpected response: ${JSON.stringify(data).slice(0, 200)}`);
            return res.json({ reply: data.choices[0].message.content });
        }

        // --- CLAUDE ---
        if (selectedModel === "claude") {
            const messages = [
                ...toOpenAIHistory(parsedHistory), // Claude uses same role format as OpenAI
                { role: "user", content: message }
            ];

            const response = await fetchFn("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "x-api-key": CLAUDE_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    model: "claude-opus-4-7",
                    max_tokens: 8192,
                    system: SYSTEM_PROMPT,
                    messages
                })
            });
            const data = await response.json();
            console.log('[Claude] status:', response.status, JSON.stringify(data).slice(0, 300));
            if (data.error) throw new Error(`Claude: ${data.error.message} (${data.error.type || 'unknown'})`);
            if (!data.content?.[0]?.text) throw new Error(`Claude unexpected response: ${JSON.stringify(data).slice(0, 200)}`);
            return res.json({ reply: data.content[0].text });
        }

        // --- GEMINI (default) ---
        const chat = geminiModel.startChat({ history: toGeminiHistory(parsedHistory) });
        const result = await chat.sendMessage(message || "Hello");
        res.json({ reply: result.response.text() });

    } catch (error) {
        console.error("SERVER ERROR:", error.message);
        res.status(500).json({ reply: `SERVER ERROR: ${error.message}` });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`AiEdits server running on port ${PORT}`);
    console.log(`  Gemini key: ${GEMINI_KEY ? 'SET' : 'MISSING'}`);
    console.log(`  Claude key: ${CLAUDE_KEY ? 'SET' : 'MISSING'}`);
    console.log(`  GPT key:    ${GPT_KEY ? 'SET' : 'MISSING'}`);
});

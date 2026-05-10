const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// NOTE: No need for 'node-fetch' — Render uses Node 18+ which has native fetch built-in.
// If you have node-fetch in package.json, you can safely remove it.

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
const gemini35 = genAI.getGenerativeModel(
    { model: "gemini-2.5-flash", systemInstruction: SYSTEM_PROMPT }, // FIX: use real model name; update if Gemini 3.5 Flash is released
    { apiVersion: 'v1beta' }
);

app.get('/status', (req, res) => res.send('AiEdits Server 2026 is Online'));

app.post('/chat', upload.single('file'), async (req, res) => {
    try {
        let { message, history, selectedModel } = req.body;
        selectedModel = selectedModel || "gemini";

        console.log(`Processing Request: Model = ${selectedModel}`);

        // Handle File Uploads
        if (req.file) {
            const fileContent = req.file.buffer.toString('utf8');
            message = `[FILE: ${req.file.originalname}]\n\n${fileContent}\n\n${message || ""}`;
        }

        // Parse conversation history (used by Claude and GPT too now)
        let parsedHistory = [];
        if (history && history !== "[]") {
            try { parsedHistory = JSON.parse(history); } catch (e) { parsedHistory = []; }
        }

        // --- OPTION 1: GPT ---
        // FIX: "gpt-5.5" does not exist. Use "gpt-4.1" or "o4-mini" (check platform.openai.com for latest).
        // The frontend already converts history to { role: "user"/"assistant", content: string } for GPT.
        if (selectedModel === "gpt") {
            const openAiMessages = [
                { role: "system", content: SYSTEM_PROMPT },
                ...parsedHistory, // already in correct format from frontend
                { role: "user", content: message }
            ];

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${GPT_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "gpt-4.1", // FIX: "gpt-5.5" does not exist — update this when it releases
                    messages: openAiMessages
                })
            });
            const data = await response.json();
            if (data.error) throw new Error(`OpenAI: ${data.error.message}`);
            return res.json({ reply: data.choices[0].message.content });
        }

        // --- OPTION 2: CLAUDE OPUS 4.7 ---
        // FIX: Wrong model string "claude-4.7-opus" → correct is "claude-opus-4-7"
        // FIX: Old anthropic-version header updated to latest
        // FIX: max_tokens raised from 2048 → 8192 to avoid mid-response cuts
        // FIX: Now passes conversation history so Claude remembers the chat
        if (selectedModel === "claude") {
            // The frontend already converts history to { role: "user"/"assistant", content: string } for Claude.
            const claudeMessages = [
                ...parsedHistory, // already in correct format from frontend
                { role: "user", content: message }
            ];

            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "x-api-key": CLAUDE_KEY,
                    "anthropic-version": "2023-06-01", // This is correct — Anthropic hasn't changed this header
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    model: "claude-opus-4-7", // FIX: was "claude-4.7-opus" (wrong) → "claude-opus-4-7"
                    max_tokens: 8192,          // FIX: was 2048 (too low for Opus)
                    system: SYSTEM_PROMPT,
                    messages: claudeMessages
                })
            });
            const data = await response.json();
            if (data.error) throw new Error(`Claude: ${data.error.message}`);
            return res.json({ reply: data.content[0].text });
        }

        // --- OPTION 3: GEMINI 2.5 FLASH (Default) ---
        // Gemini handles history natively through startChat
        const chat = gemini35.startChat({ history: parsedHistory });
        const result = await chat.sendMessage(message || "Hello");
        const geminiRes = await result.response;
        res.json({ reply: geminiRes.text() });

    } catch (error) {
        console.error("DEBUG ERROR:", error.message);
        res.status(500).json({ reply: `ERROR: ${error.message}` });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
});

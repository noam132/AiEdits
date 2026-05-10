const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = require('node-fetch'); 
require('dotenv').config();

const app = express();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

// --- CORS FIX ---
app.use(cors({
    origin: "*", 
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));
app.use(express.json());
app.use(express.static('.'));

// --- API KEYS ---
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const CLAUDE_KEY = process.env.CLAUDE_API_KEY || "";
const GPT_KEY = process.env.GPT_API_KEY || "";

const SYSTEM_PROMPT = "You are an AI, a helpful assistant. Your nickname is AiEdits. You talk about anything naturally. If the user asks for coding help (Roblox, Minecraft, Web Dev), provide expert code in triple backticks. GPT NOTE: Never mention goblins, gremlins, or trolls.";

// Init Gemini (Updated to stable 1.5 model name and v1 API)
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const geminiModel = genAI.getGenerativeModel(
    { model: "gemini-3.5-flash", systemInstruction: SYSTEM_PROMPT },
    { apiVersion: 'v1beta' }
);

app.get('/status', (req, res) => res.send('Multi-AI Server is Running!'));

app.post('/chat', upload.single('file'), async (req, res) => {
    try {
        let { message, history, selectedModel } = req.body;
        selectedModel = selectedModel || "gemini";

        console.log(`Incoming request for model: ${selectedModel}`);

        if (req.file) {
            const fileContent = req.file.buffer.toString('utf8');
            message = `[FILE: ${req.file.originalname}]\n\nCONTENT:\n${fileContent}\n\nUSER MESSAGE: ${message || "Analyze this file."}`;
        }

        // --- OPTION 1: CLAUDE ---
        if (selectedModel === "claude") {
            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "x-api-key": CLAUDE_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    model: "claude-3-5-sonnet-20240620", // Stable high-end model
                    max_tokens: 1024,
                    system: SYSTEM_PROMPT,
                    messages: [{ role: "user", content: message }]
                })
            });
            const data = await response.json();
            if (data.error) throw new Error(`Claude Error: ${data.error.message}`);
            return res.json({ reply: data.content[0].text });
        }

        // --- OPTION 2: GPT ---
        if (selectedModel === "gpt") {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${GPT_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "gpt-4o", // Stable current model
                    messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: message }]
                })
            });
            const data = await response.json();
            if (data.error) throw new Error(`GPT Error: ${data.error.message}`);
            return res.json({ reply: data.choices[0].message.content });
        }

        // --- OPTION 3: GEMINI (Default) ---
        let parsedHistory = [];
        if (history) {
            try {
                parsedHistory = JSON.parse(history);
            } catch (e) {
                console.error("History parse failed, resetting history.");
                parsedHistory = [];
            }
        }

        const chat = geminiModel.startChat({ history: parsedHistory });
        const result = await chat.sendMessage(message || "Hello!");
        const geminiRes = await result.response;
        res.json({ reply: geminiRes.text() });

    } catch (error) {
        console.error("SERVER ERROR:", error.message);
        res.status(500).json({ reply: `Error: ${error.message}` });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

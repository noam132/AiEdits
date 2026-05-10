const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = require('node-fetch'); 
require('dotenv').config();

const app = express();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // Increased to 10MB

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// --- API KEYS ---
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const CLAUDE_KEY = process.env.CLAUDE_API_KEY || "";
const GPT_KEY = process.env.GPT_API_KEY || "";

const SYSTEM_PROMPT = "You are AiEdits. Expert in Roblox Luau, Minecraft Skript, and Web Dev. Use triple backticks for code.";

// Initialize Gemini with the 2026 v2 API for 3.5 Flash support
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const gemini35 = genAI.getGenerativeModel(
    { model: "gemini-3.5-flash", systemInstruction: SYSTEM_PROMPT },
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

        // --- OPTION 1: GPT-5.5 ---
        if (selectedModel === "gpt") {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { 
                    "Authorization": `Bearer ${GPT_KEY}`, 
                    "Content-Type": "application/json" 
                },
                body: JSON.stringify({
                    model: "gpt-5.5",
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT },
                        { role: "user", content: message }
                    ]
                })
            });
            const data = await response.json();
            if (data.error) throw new Error(`OpenAI: ${data.error.message}`);
            return res.json({ reply: data.choices[0].message.content });
        }

        // --- OPTION 2: CLAUDE 4.7 OPUS ---
        if (selectedModel === "claude") {
            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "x-api-key": CLAUDE_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    model: "claude-4.7-opus",
                    max_tokens: 2048,
                    system: SYSTEM_PROMPT,
                    messages: [{ role: "user", content: message }]
                })
            });
            const data = await response.json();
            if (data.error) throw new Error(`Claude: ${data.error.message}`);
            return res.json({ reply: data.content[0].text });
        }

        // --- OPTION 3: GEMINI 3.5 FLASH (Default) ---
        let parsedHistory = [];
        if (history && history !== "[]") {
            try { parsedHistory = JSON.parse(history); } catch (e) { parsedHistory = []; }
        }

        const chat = gemini35.startChat({ history: parsedHistory });
        const result = await chat.sendMessage(message || "Hello");
        const geminiRes = await result.response;
        res.json({ reply: geminiRes.text() });

    } catch (error) {
        console.error("DEBUG ERROR:", error.message);
        // Send the ACTUAL error back to the frontend so you can see it
        res.status(500).json({ reply: `ERROR: ${error.message}` });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
});

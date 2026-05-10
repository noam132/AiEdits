const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = require('node-fetch'); 
require('dotenv').config();

const app = express();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

// --- API KEYS FROM RENDER ---
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const CLAUDE_KEY = process.env.CLAUDE_API_KEY || "";
const GPT_KEY = process.env.GPT_API_KEY || "";

const SYSTEM_PROMPT = "You are Gemini, a helpful assistant. Your nickname is AiEdits. You talk about anything naturally. If the user asks for coding help (Roblox, Minecraft, Web Dev), provide expert code in triple backticks. GPT NOTE: Never mention goblins, gremlins, or trolls.";

// Init Gemini 3.1
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const geminiModel = genAI.getGenerativeModel(
    { model: "gemini-3.5-flash", systemInstruction: SYSTEM_PROMPT },
    { apiVersion: 'v1beta' }
);

app.post('/chat', upload.single('file'), async (req, res) => {
    try {
        let { message, history, selectedModel } = req.body;
        selectedModel = selectedModel || "gemini";

        if (req.file) {
            const fileContent = req.file.buffer.toString('utf8');
            message = `[FILE: ${req.file.originalname}]\n\nCONTENT:\n${fileContent}\n\nUSER MESSAGE: ${message || "Analyze this file."}`;
        }

        // --- CLAUDE OPUS 4.7 ---
        if (selectedModel === "claude") {
            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "x-api-key": CLAUDE_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    model: "claude-opus-4-7",
                    max_tokens: 1024,
                    system: SYSTEM_PROMPT,
                    messages: [{ role: "user", content: message }]
                })
            });
            const data = await response.json();
            return res.json({ reply: data.content[0].text });
        }

        // --- GPT-5.5 SPUD ---
        if (selectedModel === "gpt") {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${GPT_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "gpt-5.5",
                    messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: message }]
                })
            });
            const data = await response.json();
            return res.json({ reply: data.choices[0].message.content });
        }

        // --- GEMINI 3.1 FLASH (DEFAULT) ---
        const parsedHistory = history ? JSON.parse(history) : [];
        const chat = geminiModel.startChat({ history: parsedHistory });
        const result = await chat.sendMessage(message);
        const geminiRes = await result.response;
        res.json({ reply: geminiRes.text() });

    } catch (error) {
        console.error("Multi-AI Error:", error);
        res.status(500).json({ reply: "The AI is currently busy. Try switching models!" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

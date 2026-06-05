const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const SYSTEM_PROMPT = "You are AiEdits. Expert in Roblox Luau, Minecraft Skript, and Web Dev. Use triple backticks for code.";

const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const geminiModel = genAI.getGenerativeModel(
    { model: "gemini-3.5-flash", systemInstruction: SYSTEM_PROMPT },
    { apiVersion: 'v1' }
);

app.get('/status', (req, res) => res.send('AiEdits Server is Online'));

app.post('/chat', upload.single('file'), async (req, res) => {
    try {
        let { message, history } = req.body;

        if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY is not set in Render environment variables.");

        if (req.file) {
            const fileContent = req.file.buffer.toString('utf8');
            message = `[FILE: ${req.file.originalname}]\n\n${fileContent}\n\n${message || ""}`;
        }

        let parsedHistory = [];
        if (history && history !== "[]") {
            try { parsedHistory = JSON.parse(history); } catch { parsedHistory = []; }
        }

        const chat = geminiModel.startChat({ history: parsedHistory });
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
});

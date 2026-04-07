const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();

// --- FILE SIZE CHECK (5MB) ---
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// --- API KEY CONFIG ---
const apiKey = process.env.GEMINI_API_KEY || "DUMMY_KEY";
const genAI = new GoogleGenerativeAI(apiKey);

// --- MODEL & PERSONALITY ---
// Using Gemini 3 Flash Preview as requested
const model = genAI.getGenerativeModel(
    { 
        model: "gemini-3-flash-preview",
        systemInstruction: "You are Gemini, a helpful assistant.Your nickname is AiEdits. You talk about anything naturally. If the user asks for coding help (Roblox, Minecraft, Web Dev), provide expert code in triple backticks."
    }, 
    { apiVersion: 'v1beta' }
);

// Render Health Check
app.get('/status', (req, res) => res.send('AI Server is Running!'));

app.post('/chat', upload.single('file'), async (req, res) => {
    try {
        let message = req.body.message || "";
        let history = [];
        
        // Safety check for history
        if (req.body.history) {
            try {
                const parsed = JSON.parse(req.body.history);
                history = parsed.map(item => ({
                    role: item.role,
                    parts: [{ text: item.parts[0].text }]
                }));
            } catch (e) {
                console.warn("History parse error:", e);
            }
        }

        // --- FILE CHECK ---
        if (req.file) {
            const fileContent = req.file.buffer.toString('utf8');
            message = `[FILE: ${req.file.originalname}]\n\nCONTENT:\n${fileContent}\n\nUSER MESSAGE: ${message || "Analyze this file."}`;
        }

        if (!message && !req.file) {
            return res.status(400).json({ reply: "Please enter a message." });
        }

        // --- SENDING TO GEMINI ---
        const chat = model.startChat({ history });
        const result = await chat.sendMessage(message);
        const response = await result.response;
        
        res.json({ reply: response.text() });

    } catch (error) {
        console.error("Gemini Error:", error);

        // Specific fix for "AI is Busy" / Rate Limits
        if (error.message.includes("429") || error.message.includes("503")) {
            res.status(500).json({ reply: "System is a bit crowded! Give me 10 seconds and try sending that again." });
        } else if (apiKey === "DUMMY_KEY") {
            res.status(500).json({ reply: "Error: API Key is missing from Render Environment Variables." });
        } else {
            res.status(500).json({ reply: "I had a tiny glitch processing that. Can you try one more time?" });
        }
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

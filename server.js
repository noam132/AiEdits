const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors());
app.use(express.json()); // Needed to parse the history array

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

app.post('/chat', upload.single('file'), async (req, res) => {
    try {
        let message = req.body.message;
        // Parse the history sent from script.js
        let history = req.body.history ? JSON.parse(req.body.history) : [];
        
        if (req.file) {
            const fileContent = req.file.buffer.toString('utf8');
            message = `[FILE: ${req.file.originalname}]\n\n${fileContent}\n\nUSER: ${message || "Analyze this."}`;
        }

        // Initialize chat with existing history
        const chat = model.startChat({ history: history });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        
        res.json({ reply: response.text() });
    } catch (error) {
        console.error("❌ ERROR:", error.message);
        res.status(500).json({ reply: "Server error. Session may have timed out." });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 GeminiServer: ONLINE with Memory`));
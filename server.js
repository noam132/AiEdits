const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

// Health check endpoint for Render
app.get('/', (req, res) => res.send('AI Server is Running!'));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

app.post('/chat', upload.single('file'), async (req, res) => {
    try {
        let message = req.body.message;
        let history = req.body.history ? JSON.parse(req.body.history) : [];
        
        if (req.file) {
            const fileContent = req.file.buffer.toString('utf8');
            message = `[FILE: ${req.file.originalname}]\n\n${fileContent}\n\nUSER: ${message || "Analyze this."}`;
        }

        const chat = model.startChat({ history: history });
        const result = await chat.sendMessage(message);
        const response = await result.response;
        
        res.json({ reply: response.text() });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ reply: "The AI is having trouble thinking. Try again." });
    }
});

// FIXED: Listen on the port Render provides
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on port ${PORT}`);
});

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

// Serves index.html, style.css, and script.js automatically
app.use(express.static('.'));

// Health check endpoint for Render
app.get('/status', (req, res) => res.send('AI Server is Running!'));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// FIX: Using -latest ensures the model is found on the stable v1 API
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

app.post('/chat', upload.single('file'), async (req, res) => {
    try {
        let message = req.body.message || "";
        
        // Handle history safely
        let history = [];
        if (req.body.history) {
            try {
                history = typeof req.body.history === 'string' ? JSON.parse(req.body.history) : req.body.history;
            } catch (e) {
                console.error("History parse error:", e);
            }
        }
        
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
        // Returns the actual error message to help troubleshooting
        res.status(500).json({ reply: "AI Error: " + error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on port ${PORT}`);
});

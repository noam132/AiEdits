let chats = JSON.parse(localStorage.getItem('ai_chats')) || [];
let currentChatId = null;

const chatList = document.getElementById('chatList');
const chatLog = document.getElementById('chatLog');
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

// --- HISTORY FORMAT ---
// New format: { role: "user"/"model", text: "...", modelName: "..." }
// Backward compat: also handles old Gemini format { role, parts: [{ text }] }
function getText(m) {
    if (typeof m.text === 'string') return m.text;           // new format
    if (m.parts?.[0]?.text) return m.parts[0].text;          // old Gemini format
    return "";
}

// Convert stored history to the format the server needs per model
function buildServerHistory(history, model) {
    return history.map(m => {
        const text = getText(m);
        if (model === "gemini") {
            // Gemini needs parts format
            return { role: m.role, parts: [{ text }] };
        } else {
            // Claude and GPT need role: "user"/"assistant" + content string
            return {
                role: m.role === "model" ? "assistant" : "user",
                content: text
            };
        }
    });
}

// --- STARTUP ---
if (chats.length > 0) {
    loadChat(chats[0].id);
} else {
    createNewChat();
}

function createNewChat() {
    const newChat = { id: Date.now(), name: "New Chat", history: [] };
    chats.unshift(newChat);
    saveChats();
    loadChat(newChat.id);
}

function saveChats() {
    localStorage.setItem('ai_chats', JSON.stringify(chats));
    renderSidebar();
}

function renderSidebar() {
    chatList.innerHTML = '';
    chats.forEach(chat => {
        const item = document.createElement('div');
        const isActive = chat.id === currentChatId;

        item.className = `chat-item ${isActive ? 'active-chat' : ''}`;

        item.innerHTML = `
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${chat.name}</span>
            <div style="position: relative;">
                <button class="chat-options-btn" onclick="toggleMenu(event, ${chat.id})">⋮</button>
                <div id="menu-${chat.id}" class="chat-options-menu">
                    <div onclick="renameChat(event, ${chat.id})">Rename</div>
                    <div onclick="deleteChat(event, ${chat.id})" style="color:#ff4444; font-weight:bold;">Delete</div>
                </div>
            </div>
        `;

        item.onclick = (e) => {
            if (!e.target.classList.contains('chat-options-btn')) {
                loadChat(chat.id);
            }
        };

        chatList.appendChild(item);
    });
}

// --- MENU LOGIC ---
function toggleMenu(event, id) {
    event.stopPropagation();
    const menu = document.getElementById(`menu-${id}`);

    document.querySelectorAll('.chat-options-menu').forEach(m => {
        if (m !== menu) m.style.display = 'none';
    });

    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

// FIX: use document-level click listener more safely
document.addEventListener('click', (e) => {
    if (!e.target.classList.contains('chat-options-btn')) {
        document.querySelectorAll('.chat-options-menu').forEach(m => m.style.display = 'none');
    }
});

// --- CHAT LOGIC ---
function loadChat(id) {
    currentChatId = id;
    const chat = chats.find(c => c.id === id);
    if (!chat) return;

    document.getElementById('activeChatTitle').innerText = chat.name;
    chatLog.innerHTML = '';

    chat.history.forEach(m => {
        const label = m.role === 'user' ? 'You' : (m.modelName || 'AI');
        const text = getText(m); // FIX: handles both old and new history formats safely
        if (text) appendMessage(label, text);
    });

    renderSidebar();
}

function appendMessage(sender, message) {
    const msgDiv = document.createElement("div");
    const isUser = sender === 'You';
    msgDiv.style = `padding: 15px; margin: 15px 0; border-radius: 12px; border: 1px solid ${isUser ? '#00ffff' : '#333'}; background: ${isUser ? 'rgba(0, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)'};`;

    let formattedText = message;
    if (!isUser) {
        formattedText = message.replace(/```(\w*\n)?([\s\S]*?)```/g, (match, lang, code) => {
            const langLabel = lang ? lang.trim() : '';
            return `
                <pre style="position:relative; background:#000; padding:15px; border-radius:8px; border:1px solid #00ffff; color:#00ffff; overflow-x:auto; margin-top:8px;">
                    ${langLabel ? `<span style="position:absolute; left:10px; top:10px; font-size:10px; opacity:0.6;">${langLabel}</span>` : ''}
                    <button class="copy-btn" onclick="copyToClipboard(this)" style="position:absolute; right:10px; top:10px; background:#000; color:#00ffff; border:1px solid #00ffff; cursor:pointer; padding: 4px 8px; font-size: 10px;">Copy</button>
                    <code style="${langLabel ? 'display:block; margin-top:20px;' : ''}">${escapeHtml(code.trim())}</code>
                </pre>`;
        });
        // Also render **bold** markdown
        formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }

    msgDiv.innerHTML = `<strong style="color:#00ffff; font-size: 1.1em;">${sender}:</strong>
                        <div style="margin-top:8px; line-height:1.6; white-space: pre-wrap;">${formattedText}</div>`;

    chatLog.appendChild(msgDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
}

// FIX: escape HTML in code blocks so injected HTML tags don't break the display
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function copyToClipboard(btn) {
    const code = btn.nextElementSibling.innerText;
    navigator.clipboard.writeText(code).then(() => {
        const originalText = btn.innerText;
        btn.innerText = "DONE!";
        btn.style.background = "#00ffff";
        btn.style.color = "#000";
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = "#000";
            btn.style.color = "#00ffff";
        }, 2000);
    });
}

// --- SEND LOGIC ---
sendBtn.onclick = async () => {
    const msg = input.value.trim();
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    const modelToUse = typeof selectedModel !== 'undefined' ? selectedModel : 'gemini';
    const modelLabel = modelToUse.toUpperCase();

    if (!msg && !file) return;

    sendBtn.disabled = true;
    sendBtn.innerText = "WAIT...";

    const displayMsg = msg || `Sent file: ${file.name}`;
    appendMessage("You", displayMsg);
    input.value = "";

    const chat = chats.find(c => c.id === currentChatId);

    if (chat.name === "New Chat" && msg) {
        chat.name = msg.substring(0, 25) + (msg.length > 25 ? "..." : "");
    }

    // FIX: convert history to correct server format per model before sending
    const serverHistory = buildServerHistory(chat.history, modelToUse);

    const formData = new FormData();
    formData.append('message', msg);
    formData.append('history', JSON.stringify(serverHistory));
    formData.append('selectedModel', modelToUse);
    if (file) formData.append('file', file);

    fileInput.value = "";
    document.getElementById('fileStatus').innerText = "";

    try {
        const res = await fetch("https://aiedits.onrender.com/chat", {
            method: "POST",
            body: formData
        });

        // Always parse JSON even on errors — server sends { reply: "SERVER ERROR: ..." }
        // so we can show the real error message instead of just "500"
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.reply || `Server error ${res.status}`);
        }

        appendMessage(modelLabel, data.reply);

        // FIX: store in new unified format { role, text, modelName }
        // This avoids the Gemini-specific parts format and works for all models
        chat.history.push({
            role: "user",
            text: msg || `[File: ${file?.name || 'unknown'}]`
        });
        chat.history.push({
            role: "model",
            text: data.reply,
            modelName: modelLabel
        });

        // FIX: cap history at last 40 messages (~20 turns) to avoid localStorage overflow
        if (chat.history.length > 40) {
            chat.history = chat.history.slice(chat.history.length - 40);
        }

        saveChats();
    } catch (e) {
        console.error("Fetch error:", e);
        appendMessage("SYSTEM", `Error: ${e.message}. Make sure the Render service is awake!`);
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerText = "Send";
    }
};

// --- CHAT MANAGEMENT ---
function renameChat(event, id) {
    event.stopPropagation();
    const newName = prompt("Enter new chat name:");
    if (newName && newName.trim()) {
        const chat = chats.find(c => c.id === id);
        chat.name = newName.trim();
        saveChats();
        if (id === currentChatId) {
            document.getElementById('activeChatTitle').innerText = chat.name;
        }
    }
}

function deleteChat(event, id) {
    event.stopPropagation();
    if (confirm("Are you sure you want to delete this chat?")) {
        chats = chats.filter(c => c.id !== id);
        if (chats.length === 0) {
            createNewChat();
        } else if (currentChatId === id) {
            loadChat(chats[0].id);
        }
        saveChats();
    }
}

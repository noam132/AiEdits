let chats = JSON.parse(localStorage.getItem('ai_chats')) || [];
let currentChatId = null;

const chatList = document.getElementById('chatList');
const chatLog = document.getElementById('chatLog');
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

// --- STARTUP LOGIC ---
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

    const isVisible = menu.style.display === 'block';
    menu.style.display = isVisible ? 'none' : 'block';
}

window.onclick = () => {
    document.querySelectorAll('.chat-options-menu').forEach(m => m.style.display = 'none');
};

// --- CHAT LOGIC ---
function loadChat(id) {
    currentChatId = id;
    const chat = chats.find(c => c.id === id);
    document.getElementById('activeChatTitle').innerText = chat.name;
    chatLog.innerHTML = '';
    
    chat.history.forEach(m => {
        const label = m.role === 'user' ? 'You' : (m.modelName || 'AI');
        appendMessage(label, m.parts[0].text);
    });
    
    renderSidebar();
}

function appendMessage(sender, message) {
    const msgDiv = document.createElement("div");
    const isUser = sender === 'You';
    msgDiv.style = `padding: 15px; margin: 15px 0; border-radius: 12px; border: 1px solid ${isUser ? '#00ffff' : '#333'}; background: ${isUser ? 'rgba(0, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)'};`;

    let formattedText = message;
    if (!isUser) {
        // Neon Code Block formatting
        formattedText = message.replace(/```([\s\S]*?)```/g, (match, code) => {
            return `
                <pre style="position:relative; background:#000; padding:15px; border-radius:8px; border:1px solid #00ffff; color:#00ffff; overflow-x:auto;">
                    <button class="copy-btn" onclick="copyToClipboard(this)" style="position:absolute; right:10px; top:10px; background:#000; color:#00ffff; border:1px solid #00ffff; cursor:pointer; padding: 4px 8px; font-size: 10px;">Copy</button>
                    <code>${code.trim()}</code>
                </pre>`;
        });
    }

    msgDiv.innerHTML = `<strong style="color:#00ffff; font-size: 1.1em;">${sender}:</strong> 
                        <div style="margin-top:8px; line-height:1.6; white-space: pre-wrap;">${formattedText}</div>`;
    
    chatLog.appendChild(msgDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
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

    // Loading State
    sendBtn.disabled = true;
    sendBtn.innerText = "WAIT...";

    appendMessage("You", msg || `Sent file: ${file.name}`);
    input.value = "";
    
    const chat = chats.find(c => c.id === currentChatId);
    
    if (chat.name === "New Chat" && msg) {
        chat.name = msg.substring(0, 20) + (msg.length > 20 ? "..." : "");
    }

    const formData = new FormData();
    formData.append('message', msg);
    formData.append('history', JSON.stringify(chat.history));
    formData.append('selectedModel', modelToUse);
    if (file) formData.append('file', file);
    
    fileInput.value = "";
    document.getElementById('fileStatus').innerText = "";

    try {
 const res = await fetch("https://aiedits.onrender.com/chat", {
        
        if (!res.ok) throw new Error("Server response not OK");
        
        const data = await res.json();
        appendMessage(modelLabel, data.reply);
        
        chat.history.push({ role: "user", parts: [{ text: msg || `[File: ${file.name}]` }] });
        chat.history.push({ 
            role: "model", 
            modelName: modelLabel, 
            parts: [{ text: data.reply }] 
        });
        saveChats();
    } catch (e) {
        console.error("Fetch error:", e);
        appendMessage("SYSTEM", "Error connecting to AI server. Make sure the Render service is awake!");
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerText = "Send";
    }
};

// --- CHAT MANAGEMENT ---
function renameChat(event, id) {
    event.stopPropagation();
    const newName = prompt("Enter new chat name:");
    if (newName) {
        const chat = chats.find(c => c.id === id);
        chat.name = newName;
        saveChats();
        if (id === currentChatId) {
            document.getElementById('activeChatTitle').innerText = newName;
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

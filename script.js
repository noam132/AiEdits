let chats = JSON.parse(localStorage.getItem('ai_chats')) || [];
let currentChatId = null;

const chatList = document.getElementById('chatList');
const chatLog = document.getElementById('chatLog');
const input = document.getElementById("messageInput");

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
        
        // Using the God-Tier Sidebar styles from your CSS
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

        // Click item to load chat (but not if clicking the dots)
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
    
    // Close all other open menus first
    document.querySelectorAll('.chat-options-menu').forEach(m => {
        if (m !== menu) m.style.display = 'none';
    });

    // Toggle current menu
    const isVisible = menu.style.display === 'block';
    menu.style.display = isVisible ? 'none' : 'block';
}

// Close menus if clicking anywhere else on the screen
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
        appendMessage(m.role === 'user' ? 'You' : 'AI', m.parts[0].text);
    });
    
    renderSidebar();
}

function appendMessage(sender, message) {
    const msgDiv = document.createElement("div");
    // Styling the message bubble
    msgDiv.style = `padding: 15px; margin: 15px 0; border-radius: 12px; border: 1px solid ${sender === 'You' ? '#00ffff' : '#333'}; background: ${sender === 'You' ? 'rgba(0, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)'};`;

    // NEON CODE BLOCK LOGIC
    let formattedText = message;
    if (sender === "AI") {
        formattedText = message.replace(/```([\s\S]*?)```/g, (match, code) => {
            return `
                <pre>
                    <button class="copy-btn" onclick="copyToClipboard(this)">Copy</button>
                    <code>${code.trim()}</code>
                </pre>`;
        });
    }

    msgDiv.innerHTML = `<strong style="color:#00ffff; font-size: 1.1em;">${sender}:</strong> 
                        <div style="margin-top:8px; line-height:1.6;">${formattedText}</div>`;
    
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
document.getElementById("sendBtn").onclick = async () => {
    const msg = input.value.trim();
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];
    
    if (!msg && !file) return;

    // Display user message
    appendMessage("You", msg || `Sent file: ${file.name}`);
    input.value = "";
    
    const chat = chats.find(c => c.id === currentChatId);
    const formData = new FormData();
    formData.append('message', msg);
    formData.append('history', JSON.stringify(chat.history));
    if (file) formData.append('file', file);
    
    // Reset file input
    fileInput.value = "";
    document.getElementById('fileStatus').innerText = "";

    try {
        const res = await fetch("/chat", { method: "POST", body: formData });
        const data = await res.json();
        
        // Display AI message
        appendMessage("AI", data.reply);
        
        // Save to history
        chat.history.push({ role: "user", parts: [{ text: msg || `[File: ${file.name}]` }] });
        chat.history.push({ role: "model", parts: [{ text: data.reply }] });
        saveChats();
    } catch (e) {
        appendMessage("AI", "Server Error. Check your connection.");
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

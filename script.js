let chats = JSON.parse(localStorage.getItem('ai_chats')) || [];
let currentChatId = null;

const chatList = document.getElementById('chatList');
const chatLog = document.getElementById('chatLog');
const activeChatTitle = document.getElementById('activeChatTitle');
const input = document.getElementById("messageInput");

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
        
        item.style = `padding: 10px; background: ${isActive ? '#111' : 'transparent'}; color: ${isActive ? '#00d4ff' : '#000'}; border-radius: 5px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: 500; transition: 0.2s; margin-bottom: 5px; border: 1px solid ${isActive ? '#00d4ff' : 'transparent'};`;
        
        // Use ⋮ for the menu and × for quick delete
        item.innerHTML = `
            <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${chat.name}</span>
            <div style="display: flex; gap: 8px;">
                <button onclick="event.stopPropagation(); showRenameModal(${chat.id})" style="background:none; border:none; color:inherit; cursor:pointer; font-size: 18px; padding: 0 5px;">⋮</button>
                <button onclick="event.stopPropagation(); deleteChat(${chat.id})" style="background:none; border:none; color:red; cursor:pointer; font-size: 18px; padding: 0 5px;">&times;</button>
            </div>
        `;
        
        item.onclick = () => loadChat(chat.id);
        chatList.appendChild(item);
    });
}

function loadChat(id) {
    currentChatId = id;
    const chat = chats.find(c => c.id === id);
    activeChatTitle.innerText = chat.name;
    chatLog.innerHTML = '';
    chat.history.forEach(m => appendMessage(m.role === 'user' ? 'You' : 'AI', m.parts[0].text));
    renderSidebar();
}

// Rename Functions
function showRenameModal(id) {
    currentChatId = id;
    const chat = chats.find(c => c.id === id);
    document.getElementById('renameInput').value = chat.name;
    document.getElementById('renameModal').style.display = 'block';
}

function closeRenameModal() {
    document.getElementById('renameModal').style.display = 'none';
}

function confirmRename() {
    const newName = document.getElementById('renameInput').value.trim();
    if (newName) {
        const chat = chats.find(c => c.id === currentChatId);
        chat.name = newName;
        saveChats();
        activeChatTitle.innerText = newName;
    }
    closeRenameModal();
}

function deleteChat(id) {
    chats = chats.filter(c => c.id !== id);
    if (chats.length === 0) {
        createNewChat();
    } else if (currentChatId === id) {
        loadChat(chats[0].id);
    }
    saveChats();
}

document.getElementById('newChatBtn').onclick = createNewChat;

document.getElementById("sendBtn").onclick = async () => {
    const userMessage = input.value.trim();
    const chat = chats.find(c => c.id === currentChatId);
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!userMessage && !file) return;

    appendMessage("You", userMessage || (file ? `Sent a file: ${file.name}` : ""));
    input.value = "";
    
    const formData = new FormData();
    if (userMessage) formData.append('message', userMessage);
    if (file) formData.append('file', file);
    formData.append('history', JSON.stringify(chat.history));

    try {
        const response = await fetch("https://aiedits.onrender.com/chat", {
            method: "POST",
            body: formData // Use FormData for file support
        });
        const data = await response.json();
        appendMessage("AI", data.reply);
        
        if (userMessage) chat.history.push({ role: "user", parts: [{ text: userMessage }] });
        chat.history.push({ role: "model", parts: [{ text: data.reply }] });
        saveChats();
        
        // Clear file input
        fileInput.value = "";
        document.getElementById('fileStatus').innerText = "";
    } catch (e) { 
        console.error(e);
        appendMessage("AI", "Error: Connection lost."); 
    }
};

function appendMessage(sender, message) {
    const msgDiv = document.createElement("div");
    msgDiv.style.padding = "10px";
    msgDiv.style.margin = "10px 0";
    msgDiv.style.borderRadius = "8px";
    msgDiv.style.color = "#fff";
    msgDiv.style.backgroundColor = sender === "You" ? "#004a57" : "#222";
    msgDiv.style.border = `1px solid ${sender === "You" ? "#00d4ff" : "#444"}`;
    msgDiv.innerHTML = `<strong>${sender}:</strong> ${message}`;
    chatLog.appendChild(msgDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
}

// File status helper
document.getElementById('fileInput').onchange = function() {
    const status = document.getElementById('fileStatus');
    status.innerText = this.files[0] ? `Selected: ${this.files[0].name}` : "";
};

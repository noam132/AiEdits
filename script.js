let chats = JSON.parse(localStorage.getItem('ai_chats')) || [];
let currentChatId = null;
let renamingId = null;

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
    const newChat = { id: Date.now(), name: "No Name", history: [] };
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
        item.style = `padding: 10px; background: ${chat.id === currentChatId ? '#000' : 'transparent'}; color: ${chat.id === currentChatId ? '#fff' : '#000'}; border-radius: 5px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: 500; transition: 0.2s; margin-bottom: 5px;`;
        item.onclick = () => loadChat(chat.id);
        item.innerHTML = `
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">${chat.name}</span>
            <div style="position: relative;">
                <button onclick="event.stopPropagation(); toggleMenu(${chat.id})" style="background:none; border:none; color:inherit; cursor:pointer; font-size:18px;">⋮</button>
                <div id="menu-${chat.id}" style="display:none; position:absolute; right:0; top:25px; background:#000; border:1px solid #00d4ff; border-radius:5px; width:100px; z-index:20;">
                    <button onclick="event.stopPropagation(); openRenameModal(${chat.id})" style="width:100%; padding:8px; background:none; color:white; border:none; border-bottom:1px solid #333; cursor:pointer; text-align:left;">Rename</button>
                    <button onclick="event.stopPropagation(); deleteChat(${chat.id})" style="width:100%; padding:8px; background:none; color:#ff4d4d; border:none; cursor:pointer; text-align:left;">Delete</button>
                </div>
            </div>`;
        chatList.appendChild(item);
    });
}

function loadChat(id) {
    currentChatId = id;
    const chat = chats.find(c => c.id === id);
    activeChatTitle.textContent = chat.name;
    chatLog.innerHTML = '';
    chat.history.forEach(msg => appendMessage(msg.role === 'user' ? 'You' : 'AI', msg.parts[0].text));
    renderSidebar();
}

function toggleMenu(id) {
    document.querySelectorAll('[id^="menu-"]').forEach(m => m.style.display = 'none');
    document.getElementById(`menu-${id}`).style.display = 'block';
}

window.onclick = () => document.querySelectorAll('[id^="menu-"]').forEach(m => m.style.display = 'none');

function openRenameModal(id) {
    renamingId = id;
    document.getElementById('renameInput').value = chats.find(c => c.id === id).name;
    document.getElementById('renameModal').style.display = 'block';
}

function closeRenameModal() { document.getElementById('renameModal').style.display = 'none'; }

function confirmRename() {
    const chat = chats.find(c => c.id === renamingId);
    if (chat) {
        chat.name = document.getElementById('renameInput').value.trim() || "No Name";
        saveChats();
        if (currentChatId === renamingId) activeChatTitle.textContent = chat.name;
    }
    closeRenameModal();
}

function deleteChat(id) {
    chats = chats.filter(c => c.id !== id);
    chats.length === 0 ? createNewChat() : (currentChatId === id && loadChat(chats[0].id));
    saveChats();
}

document.getElementById('newChatBtn').onclick = createNewChat;

document.getElementById("sendBtn").onclick = async () => {
    const userMessage = input.value.trim();
    const chat = chats.find(c => c.id === currentChatId);
    if (!userMessage) return;

    appendMessage("You", userMessage);
    input.value = "";

    try {
        const response = await fetch("http://localhost:3000/chat", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMessage, history: JSON.stringify(chat.history) })
        });
        const data = await response.json();
        appendMessage("AI", data.reply);
        chat.history.push({ role: "user", parts: [{ text: userMessage }] });
        chat.history.push({ role: "model", parts: [{ text: data.reply }] });
        saveChats();
    } catch (e) { appendMessage("AI", "Error: Connection lost."); }
};

function appendMessage(sender, message) {
    const msgDiv = document.createElement("div");
    msgDiv.style.padding = "10px";
    msgDiv.style.borderBottom = "1px solid #30363d";
    msgDiv.innerHTML = `<strong style="color: #00d4ff;">${sender}:</strong> <span style="color: white;">${message}</span>`;
    chatLog.appendChild(msgDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
}
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
        item.innerHTML = `<span>${chat.name}</span><button onclick="deleteChat(${chat.id})" style="background:none; border:none; color:red; cursor:pointer;">&times;</button>`;
        item.onclick = (e) => { if(e.target.tagName !== 'BUTTON') loadChat(chat.id); };
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
        // FIXED: Using your Render URL instead of localhost
        const response = await fetch("https://aiedits.onrender.com/chat", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: userMessage, 
                history: JSON.stringify(chat.history) 
            })
        });
        const data = await response.json();
        appendMessage("AI", data.reply);
        
        chat.history.push({ role: "user", parts: [{ text: userMessage }] });
        chat.history.push({ role: "model", parts: [{ text: data.reply }] });
        saveChats();
    } catch (e) { 
        console.error(e);
        appendMessage("AI", "Error: Connection lost."); 
    }
};

function appendMessage(sender, message) {
    const msgDiv = document.createElement("div");
    msgDiv.style.padding = "10px";
    msgDiv.style.margin = "5px 0";
    msgDiv.style.borderRadius = "8px";
    msgDiv.style.backgroundColor = sender === "You" ? "#e3f2fd" : "#f1f1f1";
    msgDiv.innerHTML = `<strong>${sender}:</strong> ${message}`;
    chatLog.appendChild(msgDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
}

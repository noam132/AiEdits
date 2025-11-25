window.onload = function() {
  const sendBtn = document.getElementById("sendBtn");
const input = document.getElementById("messageInput");
const chatLog = document.getElementById("chatLog");

function addMessage(text, className) {
  const div = document.createElement("div");
  div.textContent = text;
  div.className = className;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function getFakeResponse(message) {
  return "I'm a robot! You said: " + message;
}

sendBtn.addEventListener("click", () => {
  const userMessage = input.value.trim();
  if (!userMessage) return;

  addMessage("You: " + userMessage, "user");
  input.value = "";

  setTimeout(() => {
    addMessage("AI: " + getFakeResponse(userMessage), "ai");
  }, 800);
});

input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendBtn.click();
  }
});

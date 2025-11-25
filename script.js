window.onload = function() {
  const sendBtn = document.getElementById("sendBtn");
  const input = document.getElementById("messageInput");
  const chatLog = document.getElementById("chatLog");

  sendBtn.addEventListener("click", function() {
    const userMessage = input.value.trim();
    if (userMessage === "") return;

    // Show user message
    const userDiv = document.createElement("div");
    userDiv.textContent = "You: " + userMessage;
    chatLog.appendChild(userDiv);

    // Fake AI response
    const aiDiv = document.createElement("div");
    aiDiv.textContent = "AI: " + getFakeResponse(userMessage);
    chatLog.appendChild(aiDiv);

    input.value = "";
  });
};

function getFakeResponse(message) {
  return "I'm a robot! You said: " + message

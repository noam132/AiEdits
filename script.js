window.onload = function() {
  console.log("JS loaded");

  const sendBtn = document.getElementById("sendBtn");
  const input = document.getElementById("messageInput");

  sendBtn.addEventListener("click", function() {
    console.log("Send clicked");
    console.log("Message:", input.value);
    alert("Sent message: " + input.value);
  });
};
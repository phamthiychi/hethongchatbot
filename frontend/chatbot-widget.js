(function () {
  const API_URL = "http://127.0.0.1:8000/chat";
  const HISTORY_URL = "http://127.0.0.1:8000/history";

  let sessionId = localStorage.getItem("chat_session_id");
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem("chat_session_id", sessionId);
  }

  const style = document.createElement("style");
  style.innerHTML = `
    #chatbot-toggle { position: fixed; bottom: 24px; right: 24px; background: #0d6efd; color: white; border: none; border-radius: 50%; width: 56px; height: 56px; font-size: 24px; cursor: pointer; z-index: 9998; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    #chatbot-widget { position: fixed; bottom: 100px; right: 24px; width: 360px; height: 520px; background: white; border-radius: 16px; box-shadow: 0 0 20px rgba(0,0,0,0.15); display: none; flex-direction: column; z-index: 9999; font-family: "Segoe UI", sans-serif; overflow: hidden; }
    #chatbot-widget-header { background: #0d6efd; padding: 14px; color: white; font-size: 16px; font-weight: bold; }
    #chatbot-widget-messages { flex: 1; padding: 12px; overflow-y: auto; background: #f1f3f5; display: flex; flex-direction: column; gap: 8px; }
    .chat-msg { max-width: 80%; padding: 10px 14px; border-radius: 16px; white-space: pre-wrap; }
    .user-msg { background: #d1e7dd; align-self: flex-end; text-align: right; }
    .bot-msg { background: #e2e3e5; align-self: flex-start; text-align: left; }
    #chatbot-widget-input { display: flex; padding: 12px; border-top: 1px solid #dee2e6; background: white; }
    #chatbot-widget-input input { flex: 1; border: 1px solid #ced4da; border-radius: 10px; padding: 10px; outline: none; margin-right: 8px; }
    #chatbot-widget-input button { background: #0d6efd; color: white; border: none; border-radius: 10px; padding: 10px 16px; cursor: pointer; }
  `;
  document.head.appendChild(style);

  const toggleBtn = document.createElement("button");
  toggleBtn.id = "chatbot-toggle";
  toggleBtn.textContent = "💬";
  document.body.appendChild(toggleBtn);

  const widget = document.createElement("div");
  widget.id = "chatbot-widget";
  widget.innerHTML = `
    <div id="chatbot-widget-header">🤖 AI Chatbot</div>
    <div id="chatbot-widget-messages"></div>
    <div id="chatbot-widget-input">
      <input type="text" placeholder="Nhập câu hỏi..." />
      <button>Gửi</button>
    </div>
  `;
  document.body.appendChild(widget);

  const input = widget.querySelector("input");
  const button = widget.querySelector("button");
  const messagesDiv = widget.querySelector("#chatbot-widget-messages");

  let messageHistory = [
    { role: "system", content: "Bạn là một trợ lý AI thân thiện, nhớ bối cảnh và tên người dùng nếu họ cung cấp." }
  ];

  async function loadHistory() {
    try {
      const res = await fetch(`${HISTORY_URL}/${sessionId}`);
      const data = await res.json();
      data.messages.forEach(m => {
        appendMessage(m.content, m.role === "user" ? "user" : "bot");
        messageHistory.push({ role: m.role, content: m.content });
      });
    } catch (err) {
      console.warn("Không thể tải lịch sử chat");
    }
  }

  toggleBtn.addEventListener("click", async () => {
    const isOpen = widget.style.display === "flex";
    widget.style.display = isOpen ? "none" : "flex";
    if (!isOpen) {
      input.focus();
      if (messageHistory.length === 1) await loadHistory();
    }
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      button.click();
    }
  });

  function appendMessage(content, sender = "user") {
    const div = document.createElement("div");
    div.className = `chat-msg ${sender === "user" ? "user-msg" : "bot-msg"}`;
    div.textContent = content;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return div;
  }

  button.addEventListener("click", async () => {
    const msg = input.value.trim();
    if (!msg) return;

    appendMessage(msg, "user");
    messageHistory.push({ role: "user", content: msg });
    input.value = "";

    const typingMsg = appendMessage("Đang trả lời...", "bot");

    try {
      const validMessages = messageHistory.slice(-8).filter(
        m => typeof m.role === "string" && typeof m.content === "string"
      );

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          messages: validMessages
        })
      });

      const data = await res.json();
      const reply = data.response || "❌ Không có phản hồi từ server";
      typingMsg.remove();
      appendMessage(reply, "bot");
      messageHistory.push({ role: "assistant", content: reply });
    } catch (err) {
      typingMsg.remove();
      appendMessage("❌ Lỗi kết nối tới server", "bot");
    }
  });
})();
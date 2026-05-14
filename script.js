const API_BASE_URL = 'https://xinyuban-xg-yhhrahwish.cn-hongkong.fcapp.run';

document.addEventListener('DOMContentLoaded', () => {
    const landingPage = document.getElementById('landing-page');
    const chatPage = document.getElementById('chat-page');
    const getStartBtn = document.getElementById('get-start-btn');
    const sendBtn = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    const chatHistory = document.getElementById('chat-history');
    const robotFace = document.getElementById('robot-face');
    
    // New Elements
    const newChatBtn = document.getElementById('new-chat-btn');
    const sessionList = document.getElementById('session-list');
    let currentSessionId = 'default';

    // Stats Elements
    const statsBtn = document.getElementById('stats-btn');
    const statsModal = document.getElementById('stats-modal');
    const closeStatsBtn = document.querySelector('.close-btn');
    const statsTableBody = document.querySelector('#stats-table tbody');

    // Transitions
    getStartBtn.addEventListener('click', () => {
        landingPage.classList.remove('active');
        setTimeout(() => {
            chatPage.classList.add('active');
            refreshSessions(); // Load sessions
            // Initial greeting if default empty? Managed by session loading now
        }, 500);
    });

    // --- Session Management ---

    function refreshSessions() {
        fetch(API_BASE_URL + '/sessions')
        .then(res => res.json())
        .then(data => {
            sessionList.innerHTML = '';
            data.sessions.forEach(s => {
                const li = document.createElement('li');
                li.classList.add('session-item');
                
                // Name span
                const nameSpan = document.createElement('span');
                nameSpan.textContent = s.name;
                nameSpan.style.flex = "1";
                li.appendChild(nameSpan);

                // Delete Button (only if not default)
                if (s.id !== 'default') {
                    const delBtn = document.createElement('span');
                    delBtn.textContent = '×';
                    delBtn.classList.add('delete-session-btn');
                    delBtn.title = "删除会话";
                    delBtn.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent switching
                        deleteSession(s.id);
                    });
                    li.appendChild(delBtn);
                }

                li.dataset.id = s.id;
                if (s.id === currentSessionId) li.classList.add('active-session');
                li.addEventListener('click', () => switchSession(s.id));
                sessionList.appendChild(li);
            });
        });
    }

    function deleteSession(id) {
        if(!confirm("确定要删除这个会话吗？")) return;
        
        fetch(API_BASE_URL + `/sessions/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if(data.success) {
                // If deleted active session, switch to default or another
                if (id === currentSessionId) {
                    currentSessionId = 'default'; // Fallback to default
                    switchSession('default');
                }
                refreshSessions();
            } else {
                alert("删除失败: " + data.error);
            }
        });
    }

    newChatBtn.addEventListener('click', () => {
        fetch(API_BASE_URL + '/new_session', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            currentSessionId = data.session_id;
            refreshSessions();
            loadSessionUI([], true); // Clear UI
        });
    });

    function switchSession(id) {
        if (id === currentSessionId) return;
        currentSessionId = id;
        refreshSessions(); // Update active class
        
        fetch(API_BASE_URL + `/session_history?session_id=${id}`)
        .then(res => res.json())
        .then(data => {
            loadSessionUI(data.chat_history || [], false);
        });
    }

    function loadSessionUI(history, isNew) {
        chatHistory.innerHTML = '';
        if (isNew) {
             appendMessage('bot', '你好呀！我是你的心灵伴侣。今天想聊聊什么呢？');
             setFace('^o^');
        } else {
            if (history.length === 0) {
                 appendMessage('bot', '你好呀！我是你的心灵伴侣。今天想聊聊什么呢？');
            } else {
                history.forEach(msg => {
                    appendMessage(msg.sender, msg.text);
                });
            }
        }
    }

    // Stats Logic
    statsBtn.addEventListener('click', loadStats);
    closeStatsBtn.addEventListener('click', () => statsModal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === statsModal) statsModal.style.display = 'none';
    });

    function loadStats() {
        fetch(API_BASE_URL + `/thoughts?session_id=${currentSessionId}`)
        .then(res => res.json())
        .then(data => {
            statsTableBody.innerHTML = '';
            data.history.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>第 ${item.turn} 次</td>
                    <td>${renderMarkdown(item.stage)}</td>
                    <td>${renderMarkdown(item.mood)}</td>
                    <td>${renderMarkdown(item.needs)}</td>
                    <td>${renderMarkdown(item.supervision)}</td>
                    <td>${renderMarkdown(item.focus)}</td>
                    <td>${renderMarkdown(item.change_tools)}</td>
                    <td>${renderMarkdown(item.notes)}</td>
                `;
                statsTableBody.appendChild(row);
            });
            statsModal.style.display = 'block';
        });
    }

    function renderMarkdown(text) {
        if (!text) return '';
        // Bold: **text** -> <b>text</b>
        let html = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        // Italic: *text* -> <i>text</i> (Be careful not to break bold)
        // html = html.replace(/\*(.*?)\*/g, '<i>$1</i>'); 
        
        // Handle newlines if not already handled by <br> tags from backend
        // Use a negative lookbehind or positive lookahead if we wanted to be fancy, 
        // but for now, simple replacement of \n to <br> is fine as long as we don't break existing <br>
        html = html.replace(/\n/g, '<br>');
        return html;
    }

    // Chat Logic
    function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;

        appendMessage('user', text);
        userInput.value = '';
        setFace('O_O'); // Thinking face
        
        // Add thinking indicator
        const thinkingId = appendThinking();

        // Call Backend
        fetch(API_BASE_URL + '/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, session_id: currentSessionId })
        })
        .then(response => response.json())
        .then(data => {
            removeThinking(thinkingId);
            appendMessage('bot', data.response);
            setFace('^w^'); // Happy face
        })
        .catch(error => {
            console.error('Error:', error);
            removeThinking(thinkingId);
            appendMessage('bot', '抱歉，我好像断线了... (T_T)');
            setFace('T_T');
        });
    }

    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    function appendMessage(sender, text) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message');
        msgDiv.classList.add(sender === 'user' ? 'user-msg' : 'bot-msg');
        msgDiv.textContent = text;
        chatHistory.appendChild(msgDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    function appendThinking() {
        const id = 'thinking-' + Date.now();
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', 'bot-msg');
        msgDiv.id = id;
        msgDiv.textContent = '思考ing...';
        msgDiv.style.opacity = '0.7';
        msgDiv.style.fontStyle = 'italic';
        chatHistory.appendChild(msgDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return id;
    }

    function removeThinking(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    // Interactive Face (Simple random changes for liveliness)
    function setFace(expression) {
        robotFace.textContent = expression;
    }
});

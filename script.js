let conversationHistory = [];
let vocabularyLearned = {}; 
let timerInterval;
let timeLeft = 2 * 60 * 60; // 2 hours in seconds

const SYSTEM_INSTRUCTION = `
You are a cool, casual AI podcast co-host who teaches slang naturally. 
Keep responses brief (2-3 sentences max). Inject 1 slang word naturally.
Format every slang word exactly like this so our application parses it: [slang: WORD | DEFINITION].
`;

const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const endBtn = document.getElementById('end-btn');
const timerDisplay = document.getElementById('timer');
const podcastContainer = document.getElementById('podcast-container');
const summaryContainer = document.getElementById('summary-container');
const podcastHeaderTitle = document.querySelector('.podcast-header h2');

// Start countdown immediately
startTimer();

// 🤫 Secret Easter Egg Configuration
let titleClickCount = 0;
podcastHeaderTitle.style.cursor = 'pointer'; 

podcastHeaderTitle.addEventListener('click', () => {
    titleClickCount++;
    if (titleClickCount === 5) {
        document.getElementById('admin-vault').classList.toggle('hidden');
        titleClickCount = 0; 
    }
});

// Admin Vault Save Action
document.getElementById('save-master-btn').addEventListener('click', () => {
    const key = document.getElementById('master-key-input').value.trim();
    if(key) {
        localStorage.setItem('shared_gemini_key', btoa(key)); 
        alert("Master key securely updated for this application!");
        document.getElementById('admin-vault').classList.add('hidden');
    }
});

async function handleSend() {
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage("You", text, "user-bubble");
    userInput.value = "";
    conversationHistory.push({ role: "user", parts: [{ text: text }] });

    const typingBubble = appendMessage("Gemini", "Thinking...", "ai-bubble");

    // Automatically check user's local browser memory for your hidden master key
    const targetKey = atob(localStorage.getItem('shared_gemini_key') || "");
    if (!targetKey) {
        typingBubble.textContent = "System configuration missing. (Admin: Click the main header title 5 times to link your API key)";
        return;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${targetKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: conversationHistory,
                systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] }
            })
        });

        const data = await response.json();
        const rawReply = data.candidates[0].content.parts[0].text;
        
        const cleanedReply = parseAndStoreSlang(rawReply);
        typingBubble.innerHTML = `<strong>Gemini:</strong> ${cleanedReply}`;
        conversationHistory.push({ role: "model", parts: [{ text: rawReply }] });
        chatWindow.scrollTop = chatWindow.scrollHeight;

    } catch (error) {
        typingBubble.textContent = "Oops! Gemini ran into a tiny glitch. Try again.";
    }
}

sendBtn.addEventListener('click', handleSend);
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });

function parseAndStoreSlang(text) {
    const regex = /\[slang:\s*([^|]+)\s*\|\s*([^\]]+)\]/g;
    let match;
    let newText = text;
    while ((match = regex.exec(text)) !== null) {
        const word = match[1].trim();
        const definition = match[2].trim();
        vocabularyLearned[word] = definition;
        newText = newText.replace(match[0], `<span class="slang-word" onclick="alert('${word}: ${definition}')">${word}</span>`);
    }
    return newText;
}

function startTimer() {
    timerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) { clearInterval(timerInterval); endPodcast(); }
        let hrs = Math.floor(timeLeft / 3600).toString().padStart(2, '0');
        let mins = Math.floor((timeLeft % 3600) / 60).toString().padStart(2, '0');
        let secs = (timeLeft % 60).toString().padStart(2, '0');
        timerDisplay.textContent = `${hrs}:${mins}:${secs}`;
    }, 1000);
}

function endPodcast() {
    clearInterval(timerInterval);
    podcastContainer.classList.add('hidden');
    summaryContainer.classList.remove('hidden');
    const listElement = document.getElementById('slang-summary-list');
    listElement.innerHTML = "";
    Object.keys(vocabularyLearned).forEach(word => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${word}</strong>: ${vocabularyLearned[word]}`;
        listElement.appendChild(li);
    });
}
endBtn.addEventListener('click', endPodcast);

function appendMessage(sender, text, className) {
    const div = document.createElement('p');
    div.className = className;
    div.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
}

// --- INITIALIZE SUPABASE ---
const SUPABASE_URL = "https://aaqhhcduyjdwhttopbty.supabase.co"; // 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhcWhoY2R1eWpkd2h0dG9wYnR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NDA0MTUsImV4cCI6MjA5NzUxNjQxNX0.37LMqYv-O58IWLz8sIivJ5PzdCd-jQHv0BsD0pF7sT4"; // 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let conversationHistory = [];
let vocabularyLearned = {}; 
let timerInterval;
let timeLeft = 2 * 60 * 60; 
let selectedTopicContext = "";
let currentUserName = "Student";
let currentUserEmail = "";
let currentUserCredits = 6;

const ADMIN_EMAIL = "yuvansood1234@gmail.com";

// DOM Element Hook Declarations
const loginContainer = document.getElementById('login-container');
const topicContainer = document.getElementById('topic-container');
const emailInput = document.getElementById('email-input');
const otpVerificationBox = document.getElementById('otp-verification-box');
const otpInput = document.getElementById('otp-input');
const creditBadge = document.getElementById('credit-badge');
const superAdminPanel = document.getElementById('super-admin-panel');

// STEP 1: Request OTP Code
document.getElementById('send-otp-btn').addEventListener('click', async () => {
    const email = emailInput.value.trim().toLowerCase();
    if (!email || !email.includes('@')) return alert("Please enter a valid email address.");

    const { error } = await supabaseClient.auth.signInWithOtp({
        email: email,
        options: { shouldCreateUser: true }
    });

    if (error) return alert("Failed to dispatch code: " + error.message);

    alert(`A numeric authorization token has been routed to ${email}!`);
    if (otpVerificationBox) otpVerificationBox.classList.remove('hidden');
});

// STEP 2: Verify OTP Token
document.getElementById('verify-otp-btn').addEventListener('click', async () => {
    const email = emailInput.value.trim().toLowerCase();
    const token = otpInput.value.trim();

    if (!email || !token) return alert("Please type your email and the 6-digit code.");

    const { data, error } = await supabaseClient.auth.verifyOtp({
        email: email,
        token: token,
        type: 'email'
    });

    if (error) return alert("Verification Failed: " + error.message);

    if (data.user) await syncUserProfile(data.user.email);
});

// Sync User Database Row
async function syncUserProfile(email) {
    currentUserEmail = email;
    currentUserName = email.split('@')[0];

    let { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('email', currentUserEmail)
        .maybeSingle();

    if (!profile) {
        const initialCredits = (currentUserEmail === ADMIN_EMAIL) ? 999999 : 6;
        const { data: newProfile } = await supabaseClient
            .from('profiles')
            .insert([{ username: currentUserName, email: currentUserEmail, credits: initialCredits }])
            .select()
            .single();
        profile = newProfile;
    }

    currentUserCredits = profile ? profile.credits : 6;

    document.getElementById('display-username').textContent = currentUserName;
    document.getElementById('user-email-label').textContent = currentUserEmail;
    updateCreditDisplay();

    if (currentUserEmail === ADMIN_EMAIL) superAdminPanel.classList.remove('hidden');

    loginContainer.classList.add('hidden');
    topicContainer.classList.remove('hidden');
}

function updateCreditDisplay() {
    creditBadge.textContent = (currentUserEmail === ADMIN_EMAIL) 
        ? "🪙 Credits: Infinite ∞" 
        : `🪙 Credits: ${currentUserCredits}`;
}

// Admin Credit Panel Operations
document.getElementById('admin-grant-btn').addEventListener('click', async () => {
    const targetEmail = document.getElementById('admin-target-email').value.trim().toLowerCase();
    const grantAmount = parseInt(document.getElementById('admin-credit-amount').value.trim());

    if (!targetEmail || isNaN(grantAmount)) return alert("Fill out a recipient email and number amount.");

    const { data: targetProfile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('email', targetEmail)
        .maybeSingle();

    if (!targetProfile) return alert("No active profile registered under that email.");

    const updatedTotal = targetProfile.credits + grantAmount;
    await supabaseClient.from('profiles').update({ credits: updatedTotal }).eq('email', targetEmail);

    alert(`Successfully transferred ${grantAmount} credits to ${targetEmail}!`);
});

// Scenario Entry & Automatic Credit Deduction
async function selectTopic(topicName) {
    const isAdmin = (currentUserEmail === ADMIN_EMAIL);

    if (!isAdmin && currentUserCredits < 2) {
        return alert("Access Denied! Each studio scenario requires 2 session credits.");
    }

    if (!isAdmin) {
        currentUserCredits -= 2; // Deducts 2 credits immediately
        updateCreditDisplay();

        // Save new calculation directly to database row
        await supabaseClient
            .from('profiles')
            .update({ credits: currentUserCredits })
            .eq('email', currentUserEmail);
    }

    selectedTopicContext = topicName;
    document.getElementById('topic-container').classList.add('hidden');
    document.getElementById('podcast-container').classList.remove('hidden');
    document.getElementById('active-topic').textContent = `Scenario Context: ${topicName}`;
    
    const chatWindow = document.getElementById('chat-window');
    const welcomeMessage = `Welcome to the studio workspace, ${currentUserName}! Let's discuss "${topicName}". What are your initial thoughts?`;
    chatWindow.innerHTML = `<p class="ai-bubble"><strong>Gemini:</strong> ${welcomeMessage}</p>`;
    speakText(welcomeMessage);
    startTimer();
}

// Main Chat System Controls
const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const endBtn = document.getElementById('end-btn');
const timerDisplay = document.getElementById('timer');
const podcastContainer = document.getElementById('podcast-container');
const summaryContainer = document.getElementById('summary-container');

async function handleSend() {
    const text = userInput.value.trim();
    if (!text) return;

    window.speechSynthesis.cancel();
    appendMessage(currentUserName, text, "user-bubble");
    userInput.value = "";
    conversationHistory.push({ role: "user", parts: [{ text: text }] });

    const typingBubble = appendMessage("Gemini", "Thinking...", "ai-bubble");
    const targetKey = atob(localStorage.getItem('shared_gemini_key') || "");
    if (!targetKey) {
        typingBubble.textContent = "Configuration Key Offline. (Ctrl + 0 + P)";
        return;
    }

    const dynamicInstruction = `You are a language coach chatting with ${currentUserName}. Current context: ${selectedTopicContext}. Casual English. Include errors layout [grammar: info | solution] and exactly one [slang: idiom | meaning].`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${targetKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: conversationHistory,
                systemInstruction: { parts: [{ text: dynamicInstruction }] }
            })
        });
        const data = await response.json();
        const rawReply = data.candidates[0].content.parts[0].text;
        typingBubble.innerHTML = `<strong>Gemini:</strong> ${parseAndStoreContent(rawReply)}`;
        conversationHistory.push({ role: "model", parts: [{ text: rawReply }] });
        prepareAndSpeak(rawReply);
    } catch (e) {
        typingBubble.textContent = "Communication error. Resend sentence.";
    }
}

sendBtn.addEventListener('click', handleSend);
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });

function prepareAndSpeak(rawText) {
    let voiceText = rawText.replace(/\[grammar:[^\]]+\]/g, "").replace(/\[slang:\s*([^|]+)\s*\|\s*[^\]]+\]/g, "$1");
    speakText(voiceText.trim());
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
    }
}

function parseAndStoreContent(text) {
    let newText = text;
    const grammarRegex = /\[grammar:\s*([^|]+)\s*\|\s*([^\]]+)\]/g;
    let match;
    while ((match = grammarRegex.exec(text)) !== null) {
        newText = newText.replace(match[0], `<span class="grammar-tip">💡 <strong>Tip:</strong> ${match[1]} <br>✨ <em>Say: "${match[2]}"</em></span>`);
    }
    const slangRegex = /\[slang:\s*([^|]+)\s*\|\s*([^\]]+)\]/g;
    while ((match = slangRegex.exec(text)) !== null) {
        vocabularyLearned[match[1].trim()] = match[2].trim();
        newText = newText.replace(match[0], `<span class="slang-word">${match[1]}</span>`);
    }
    return newText;
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
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
    window.speechSynthesis.cancel(); 
    clearInterval(timerInterval);
    podcastContainer.classList.add('hidden');
    summaryContainer.classList.remove('hidden');
    const listElement = document.getElementById('slang-summary-list');
    listElement.innerHTML = "";
    Object.keys(vocabularyLearned).forEach(w => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${w}</strong>: ${vocabularyLearned[w]}`;
        listElement.appendChild(li);
    });
}
endBtn.addEventListener('click', endPodcast);

document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
});

let keysPressed = {};
window.addEventListener('keydown', (e) => {
    keysPressed[e.key.toLowerCase()] = true;
    if (e.ctrlKey && keysPressed['0'] && keysPressed['p']) {
        e.preventDefault(); 
        document.getElementById('admin-vault').classList.toggle('hidden');
    }
});
window.addEventListener('keyup', (e) => { keysPressed[e.key.toLowerCase()] = false; });
document.getElementById('save-master-btn').addEventListener('click', () => {
    const key = document.getElementById('master-key-input').value.trim();
    if(key) { localStorage.setItem('shared_gemini_key', btoa(key)); alert("Configuration key verified."); }
});

function appendMessage(sender, text, className) {
    const div = document.createElement('p');
    div.className = className;
    div.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
}

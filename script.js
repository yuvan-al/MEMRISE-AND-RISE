// --- INITIALIZE SUPABASE ---
const SUPABASE_URL = "https://aaqhhcduyjdwhttopbty.supabase.co"; 
const SUPABASE_ANON_KEY = "re_Dm53gWvg_MaKt87ZvCzGhqoqYn1F5HT7V";
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

// SPEECH AUDIO CONNECTIONS
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
}

const loginContainer = document.getElementById('login-container');
const topicContainer = document.getElementById('topic-container');
const emailInput = document.getElementById('email-input');
const otpVerificationBox = document.getElementById('otp-verification-box');
const otpInput = document.getElementById('otp-input');
const creditBadge = document.getElementById('credit-badge');
const superAdminPanel = document.getElementById('super-admin-panel');
const talkBtn = document.getElementById('talk-btn');
const voiceStatusLabel = document.getElementById('voice-status-label');
const chatWindow = document.getElementById('chat-window');

// STEP 1: Request OTP Security Link
document.getElementById('send-otp-btn').addEventListener('click', async () => {
    const email = emailInput.value.trim().toLowerCase();
    if (!email || !email.includes('@')) return alert("Please enter a valid email address.");
    const { error } = await supabaseClient.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } });
    if (error) return alert("Failed to dispatch code: " + error.message);
    alert(`A numeric token has been routed to ${email}!`);
    if (otpVerificationBox) otpVerificationBox.classList.remove('hidden');
});

// STEP 2: Authenticate OTP Code
document.getElementById('verify-otp-btn').addEventListener('click', async () => {
    const email = emailInput.value.trim().toLowerCase();
    const token = otpInput.value.trim();
    if (!email || !token) return alert("Please type your email and the code.");
    const { data, error } = await supabaseClient.auth.verifyOtp({ email: email, token: token, type: 'email' });
    if (error) return alert("Verification Failed: " + error.message);
    if (data.user) await syncUserProfile(data.user.email);
});

async function syncUserProfile(email) {
    currentUserEmail = email;
    currentUserName = email.split('@')[0];
    let { data: profile } = await supabaseClient.from('profiles').select('*').eq('email', currentUserEmail).maybeSingle();
    if (!profile) {
        const initialCredits = (currentUserEmail === ADMIN_EMAIL) ? 999999 : 6;
        const { data: newProfile } = await supabaseClient.from('profiles').insert([{ username: currentUserName, email: currentUserEmail, credits: initialCredits }]).select().single();
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
    creditBadge.textContent = (currentUserEmail === ADMIN_EMAIL) ? "🪙 Credits: Infinite ∞" : `🪙 Credits: ${currentUserCredits}`;
}

document.getElementById('admin-grant-btn').addEventListener('click', async () => {
    const targetEmail = document.getElementById('admin-target-email').value.trim().toLowerCase();
    const grantAmount = parseInt(document.getElementById('admin-credit-amount').value.trim());
    if (!targetEmail || isNaN(grantAmount)) return alert("Fill out a recipient email and number amount.");
    const { data: targetProfile } = await supabaseClient.from('profiles').select('*').eq('email', targetEmail).maybeSingle();
    if (!targetProfile) return alert("No active profile registered under that email.");
    const updatedTotal = targetProfile.credits + grantAmount;
    await supabaseClient.from('profiles').update({ credits: updatedTotal }).eq('email', targetEmail);
    alert(`Successfully transferred ${grantAmount} credits to ${targetEmail}!`);
});

async function selectTopic(topicName) {
    const isAdmin = (currentUserEmail === ADMIN_EMAIL);
    if (!isAdmin && currentUserCredits < 2) return alert("Access Denied! Each studio scenario requires 2 session credits.");
    if (!isAdmin) {
        currentUserCredits -= 2;
        updateCreditDisplay();
        await supabaseClient.from('profiles').update({ credits: currentUserCredits }).eq('email', currentUserEmail);
    }
    selectedTopicContext = topicName;
    document.getElementById('topic-container').classList.add('hidden');
    document.getElementById('podcast-container').classList.remove('hidden');
    document.getElementById('active-topic').textContent = `Voice Context: ${topicName}`;
    
    const welcomeMessage = `Hello ${currentUserName}! Let's practice conversational skills on "${topicName}". Tap the mic button whenever you are ready to talk!`;
    
    // ON-SCREEN BRANDING: Displays "Adam" as the conversational entity label
    chatWindow.innerHTML = `<p class="ai-bubble"><strong>Adam:</strong> ${welcomeMessage}</p>`;
    speakText(welcomeMessage);
    startTimer();
}

// CAPTURING MICROPHONE STREAMS
if (recognition) {
    recognition.onstart = () => {
        isRecording = true;
        talkBtn.textContent = "🛑 Listening...";
        talkBtn.className = "talk-btn-active";
        voiceStatusLabel.textContent = "Capturing microphone input stream...";
    };

    recognition.onerror = () => { resetVoiceInterface(); };
    recognition.onend = () => { resetVoiceInterface(); };

    recognition.onresult = async (event) => {
        const spokenText = event.results[0][0].transcript;
        if (!spokenText.trim()) return;
        await processingConversationFlow(spokenText);
    };
}

talkBtn.addEventListener('click', () => {
    if (!recognition) return alert("Web Speech Engine not supported on this browser. Use Chrome or Safari.");
    window.speechSynthesis.cancel();
    if (isRecording) {
        recognition.stop();
    } else {
        recognition.start();
    }
});

function resetVoiceInterface() {
    isRecording = false;
    talkBtn.textContent = "🎤 Tap to Speak";
    talkBtn.className = "talk-btn-inactive";
    voiceStatusLabel.textContent = "Microphone Idle";
}

// PROCESSING CORE SYSTEM FLOW
async function processingConversationFlow(text) {
    appendMessage(currentUserName, text, "user-bubble");
    conversationHistory.push({ role: "user", parts: [{ text: text }] });

    // ON-SCREEN BRANDING: Updates loader to display "Adam"
    const typingBubble = appendMessage("Adam", "Analyzing vocal feedback...", "ai-bubble");
    const targetKey = atob(localStorage.getItem('shared_gemini_key') || "");
    if (!targetKey) {
        typingBubble.textContent = "Configuration Key Offline. (Ctrl + 0 + P)";
        return;
    }

    const explicitInstruction = `You are a conversational language voice partner chatting with ${currentUserName}. Current topic context: ${selectedTopicContext}. Speak in conversational English prose. If the user makes a structural mistake, inject exactly one bracket tip: [grammar: explain error briefly | provide correct short sentence]. If answering naturally, include exactly one native slang idiom inside brackets: [slang: expression | short meaning]. Do not use raw markdown blocks like "Tip:" or bold text for idioms outside these exact bracket parameters. Everything outside the brackets must be short prose spoken aloud.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${targetKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: conversationHistory,
                systemInstruction: { parts: [{ text: explicitInstruction }] }
            })
        });
        const data = await response.json();
        const rawReply = data.candidates[0].content.parts[0].text;
        
        // ON-SCREEN BRANDING: Renders outputs to the workspace under "Adam"
        typingBubble.innerHTML = `<strong>Adam:</strong> ${parseAndStoreContent(rawReply)}`;
        conversationHistory.push({ role: "model", parts: [{ text: rawReply }] });
        
        let voiceCleanText = rawReply.replace(/\[grammar:[^\]]+\]/g, "").replace(/\[slang:\s*([^|]+)\s*\|\s*[^\]]+\]/g, "$1");
        speakText(voiceCleanText.trim());
    } catch (e) {
        typingBubble.textContent = "Voice synchronization timeout. Please retry.";
    }
}

// INLINE STRUCTURAL PARSING AND DISPLAY INJECTIONS
function parseAndStoreContent(text) {
    let cleanOutput = text;
    
    // Parse Grammar Tags
    const grammarRegex = /\[grammar:\s*([^|]+)\s*\|\s*([^\]]+)\]/g;
    let match;
    while ((match = grammarRegex.exec(text)) !== null) {
        cleanOutput = cleanOutput.replace(match[0], `<span class="grammar-tip">💡 <strong>Correction:</strong> ${match[1]} <br>✨ <em>Say: "${match[2]}"</em></span>`);
    }
    
    // Parse Slang Tags and Append Meaning Context Visually
    const slangRegex = /\[slang:\s*([^|]+)\s*\|\s*([^\]]+)\]/g;
    while ((match = slangRegex.exec(text)) !== null) {
        const expression = match[1].trim();
        const definition = match[2].trim();
        
        vocabularyLearned[expression] = definition;
        cleanOutput = cleanOutput.replace(match[0], `<span class="slang-word" title="${definition}">${expression}</span> <i style="color: var(--text-muted); font-size: 0.9rem;">(${definition})</i>`);
    }
    return cleanOutput;
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) { clearInterval(timerInterval); endPodcast(); }
        let hrs = Math.floor(timeLeft / 3600).toString().padStart(2, '0');
        let mins = Math.floor((timeLeft % 3600) / 60).toString().padStart(2, '0');
        let secs = (timeLeft % 60).toString().padStart(2, '0');
        document.getElementById('timer').textContent = `${hrs}:${mins}:${secs}`;
    }, 1000);
}

function endPodcast() {
    window.speechSynthesis.cancel(); 
    clearInterval(timerInterval);
    document.getElementById('podcast-container').classList.add('hidden');
    document.getElementById('summary-container').classList.remove('hidden');
    const listElement = document.getElementById('slang-summary-list');
    listElement.innerHTML = "";
    Object.keys(vocabularyLearned).forEach(w => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${w}</strong>: ${vocabularyLearned[w]}`;
        listElement.appendChild(li);
    });
}
document.getElementById('end-btn').addEventListener('click', endPodcast);

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
    if(key) { localStorage.setItem('shared_gemini_key', btoa(key)); alert("Key loaded successfully."); }
});

function appendMessage(sender, text, className) {
    const div = document.createElement('p');
    div.className = className;
    div.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
}

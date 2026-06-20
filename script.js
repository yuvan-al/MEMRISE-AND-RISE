// --- INITIALIZE SUPABASE ---
const SUPABASE_URL = "https://aaqhhcduyjdwhttopbty.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhcWhoY2R1eWpkd2h0dG9wYnR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NDA0MTUsImV4cCI6MjA5NzUxNjQxNX0.37LMqYv-O58IWLz8sIivJ5PzdCd-jQHv0BsD0pF7sT4"; 
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

// STEP 1: Request the 6-Digit Code via Resend SMTP
document.getElementById('send-otp-btn').addEventListener('click', async () => {
    const email = emailInput.value.trim().toLowerCase();
    if (!email || !email.includes('@')) return alert("Please enter a valid email address.");

    // Trigger Supabase's native OTP engine
    const { error } = await supabaseClient.auth.signInWithOtp({
        email: email,
        options: {
            shouldCreateUser: true // Automatically creates a user record in Supabase Auth if they are new
        }
    });

    if (error) {
        return alert("Failed to send code: " + error.message);
    }

    alert(`A secure verification code has been dispatched to ${email}! Check your inbox.`);
    
    // Reveal the 6-digit code entry box
    if (otpVerificationBox) {
        otpVerificationBox.classList.remove('hidden');
    }
});

// STEP 2: Verify the Code and Sync to Database
document.getElementById('verify-otp-btn').addEventListener('click', async () => {
    const email = emailInput.value.trim().toLowerCase();
    const token = otpInput.value.trim();

    if (!email || !token) return alert("Please type your email and the code received.");

    // Validate the code with Supabase Auth
    const { data, error } = await supabaseClient.auth.verifyOtp({
        email: email,
        token: token,
        type: 'email'
    });

    if (error) {
        return alert("Invalid or Expired Code: " + error.message);
    }

    // Success! sync their profile record with your credit tables
    if (data.user) {
        await syncUserProfile(data.user.email);
    }
});

// Sync user metadata with your database profile row
async function syncUserProfile(email) {
    currentUserEmail = email;
    currentUserName = email.split('@')[0];

    // Check if user profile row already exists
    let { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('email', currentUserEmail)
        .maybeSingle();

    if (!profile) {
        // New user! Set initial signup credits
        const initialCredits = (currentUserEmail === ADMIN_EMAIL) ? 999999 : 6;
        
        const { data: newProfile, error: createError } = await supabaseClient
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

    // Show Master Panel if admin logs in
    if (currentUserEmail === ADMIN_EMAIL) {
        superAdminPanel.classList.remove('hidden');
    }

    loginContainer.classList.add('hidden');
    topicContainer.classList.remove('hidden');
}

function updateCreditDisplay() {
    if (currentUserEmail === ADMIN_EMAIL) {
        creditBadge.textContent = "🪙 Credits: Infinite ∞";
    } else {
        creditBadge.textContent = `🪙 Credits: ${currentUserCredits}`;
    }
}

// Admin Credit Transfer System
document.getElementById('admin-grant-btn').addEventListener('click', async () => {
    const targetEmail = document.getElementById('admin-target-email').value.trim().toLowerCase();
    const grantAmount = parseInt(document.getElementById('admin-credit-amount').value.trim());

    if (!targetEmail || isNaN(grantAmount)) return alert("Please fill out a valid recipient email and number amount.");

    const { data: targetProfile, error: fetchError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('email', targetEmail)
        .maybeSingle();

    if (!targetProfile) return alert("Could not find any user profile registered under that email.");

    const updatedTotal = targetProfile.credits + grantAmount;

    const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({ credits: updatedTotal })
        .eq('email', targetEmail);

    if (updateError) return alert("Failed to modify target credits: " + updateError.message);

    alert(`Successfully transferred ${grantAmount} credits to ${targetEmail}!`);
    document.getElementById('admin-target-email').value = "";
    document.getElementById('admin-credit-amount').value = "";
});

// Scenario Activation & Credit Deduction
async function selectTopic(topicName) {
    const isAdmin = (currentUserEmail === ADMIN_EMAIL);

    if (!isAdmin && currentUserCredits < 2) {
        return alert("Access Denied! Each studio scenario requires 2 session credits.");
    }

    if (!isAdmin) {
        currentUserCredits -= 2;
        updateCreditDisplay();

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
    const welcomeMessage = `Welcome to the scenario studio, ${currentUserName}! Let's practice conversing about "${topicName}". To kick things off, tell me your thoughts on this subject.`;
    
    chatWindow.innerHTML = `<p class="ai-bubble"><strong>Gemini:</strong> ${welcomeMessage}</p>`;
    speakText(welcomeMessage);
    startTimer();
}

// Core Chat Interface Functionality
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
        typingBubble.textContent = "Configuration Key Offline. (Console Access: Ctrl + 0 + P)";
        return;
    }

    const dynamicInstruction = `
    You are a professional language coach. You are chatting with a student named ${currentUserName}.
    Current speech scenario context: ${selectedTopicContext}.
    Tone: Casual, natural standard English. Do not use random text-slang yourself.

    MANDATORY SYSTEM GENERATION MATCHES:
    RULE 1 (GRAMMAR): If errors exist, lead with: [grammar: Error analysis | Corrected response layout]
    RULE 2 (SLANG): Include exactly one expression formatted as: [slang: IDIOM | INTERPRETATION DEFINITION].
    `;

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
        
        const cleanedReply = parseAndStoreContent(rawReply);
        typingBubble.innerHTML = `<strong>Gemini:</strong> ${cleanedReply}`;
        conversationHistory.push({ role: "model", parts: [{ text: rawReply }] });
        chatWindow.scrollTop = chatWindow.scrollHeight;

        prepareAndSpeak(rawReply);

    } catch (error) {
        typingBubble.textContent = "The server encountered a minor communication fault. Re-attempt sentence delivery.";
    }
}

sendBtn.addEventListener('click', handleSend);
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });

function prepareAndSpeak(rawText) {
    let voiceText = rawText.replace(/\[grammar:[^\]]+\]/g, "");
    voiceText = voiceText.replace(/\[slang:\s*([^|]+)\s*\|\s*[^\]]+\]/g, "$1");
    speakText(voiceText.trim());
}

function speakText(textToSay) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(textToSay);
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find(voice => voice.lang.includes('en-US') || voice.lang.includes('en-GB'));
        if (englishVoice) utterance.voice = englishVoice;
        window.speechSynthesis.speak(utterance);
    }
}

function parseAndStoreContent(text) {
    let newText = text;
    const grammarRegex = /\[grammar:\s*([^|]+)\s*\|\s*([^\]]+)\]/g;
    let grammarMatch;
    while ((grammarMatch = grammarRegex.exec(text)) !== null) {
        newText = newText.replace(grammarMatch[0], `<span class="grammar-tip">💡 <strong>Grammar Tip:</strong> ${grammarMatch[1].trim()} <br>✨ <em>Say: "${grammarMatch[2].trim()}"</em></span>`);
    }

    const slangRegex = /\[slang:\s*([^|]+)\s*\|\s*([^\]]+)\]/g;
    let slangMatch;
    while ((slangMatch = slangRegex.exec(text)) !== null) {
        vocabularyLearned[slangMatch[1].trim()] = slangMatch[2].trim();
        newText = newText.replace(slangMatch[0], `<span class="slang-word" onclick="alert('${slangMatch[1].trim()}: ${slangMatch[2].trim()}')">${slangMatch[1].trim()}</span>`);
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
    Object.keys(vocabularyLearned).forEach(word => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${word}</strong>: ${vocabularyLearned[word]}`;
        listElement.appendChild(li);
    });
}
endBtn.addEventListener('click', endPodcast);

document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
});

// Secret Developer Key Console Setup Shortcuts (Ctrl + 0 + P)
let keysPressed = {};
window.addEventListener('keydown', (e) => {
    keysPressed[e.key.toLowerCase()] = true;
    if (e.ctrlKey && (keysPressed['0'] || keysPressed['num0']) && keysPressed['p']) {
        e.preventDefault(); 
        document.getElementById('admin-vault').classList.toggle('hidden');
    }
});
window.addEventListener('keyup', (e) => { keysPressed[e.key.toLowerCase()] = false; });
document.getElementById('save-master-btn').addEventListener('click', () => {
    const key = document.getElementById('master-key-input').value.trim();
    if(key) { localStorage.setItem('shared_gemini_key', btoa(key)); alert("Master configuration key active!"); }
});

function appendMessage(sender, text, className) {
    const div = document.createElement('p');
    div.className = className;
    div.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: #f0f4f8;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
}

.container {
    background: white;
    padding: 30px;
    border-radius: 16px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.05);
    width: 90%;
    max-width: 600px;
    text-align: center;
}

.podcast-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
}

.podcast-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #1e293b;
}

#timer {
    font-size: 1.2rem;
    font-weight: bold;
    color: #dc2626;
}

#chat-window {
    height: 300px;
    overflow-y: auto;
    border: 1px solid #e2e8f0;
    padding: 15px;
    border-radius: 8px;
    text-align: left;
    margin-bottom: 15px;
    background-color: #fafafa;
}

.user-bubble { color: #1e3a8a; margin-bottom: 12px; line-height: 1.5; }
.ai-bubble { color: #0f172a; margin-bottom: 12px; line-height: 1.5; }

.slang-word {
    background-color: #fff3cd;
    border-bottom: 2px dashed #ffc107;
    cursor: pointer;
    font-weight: 600;
    padding: 2px 4px;
    border-radius: 4px;
}

.input-area {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
}

.input-area input {
    flex-grow: 1;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    font-size: 1rem;
}

#send-btn {
    background-color: #2563eb;
    color: white;
    border: none;
    padding: 0 20px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
}

.danger-btn {
    background-color: #ef4444;
    color: white;
    border: none;
    padding: 12px;
    width: 100%;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    font-size: 1rem;
}

.danger-btn:hover { background-color: #dc2626; }

#slang-summary-list {
    text-align: left;
    line-height: 1.8;
    margin-bottom: 20px;
}

#admin-vault {
    position: fixed;
    bottom: 20px;
    background: #ffffff;
    border: 2px solid #cbd5e1;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

#admin-vault input {
    padding: 8px;
    margin-right: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
}

#save-master-btn {
    padding: 8px 12px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.hidden { display: none !important; }

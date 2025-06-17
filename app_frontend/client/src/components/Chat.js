import React, { useState } from 'react';
import './Chat.css';

function Chat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Generate a simple session ID (in a real app, you'd want something more robust)
  const sessionId = localStorage.getItem('chatSessionId') || 
    `session_${Math.random().toString(36).substring(2, 9)}`;
  
  // Save session ID to localStorage
  if (!localStorage.getItem('chatSessionId')) {
    localStorage.setItem('chatSessionId', sessionId);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    // Add user message to chat
    const userMessage = { text: input, sender: 'user' };
    setMessages([...messages, userMessage]);
    setLoading(true);
    setInput('');
    
    // Limit prompt size to prevent header size issues
    const limitedPrompt = input.substring(0, 2000);
    
    try {
      const response = await fetch('http://localhost:8080/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: limitedPrompt,
          sessionId: sessionId.substring(0, 36) // Limit session ID length
        }),
      });
      
      const data = await response.json();
      
      // Add AI response to chat
      if (data.response) {
        setMessages(prevMessages => [
          ...prevMessages, 
          { text: data.response, sender: 'ai' }
        ]);
      } else if (data.error) {
        setMessages(prevMessages => [
          ...prevMessages, 
          { text: `Error: ${data.error}`, sender: 'ai' }
        ]);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prevMessages => [
        ...prevMessages, 
        { text: 'Sorry, something went wrong.', sender: 'ai' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.sender}`}>
            {message.text}
          </div>
        ))}
        {loading && <div className="message ai loading">Thinking...</div>}
      </div>
      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export default Chat;
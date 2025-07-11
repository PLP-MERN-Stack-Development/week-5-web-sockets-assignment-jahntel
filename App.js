
import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import './App.css'; // Assuming you have some basic styling

// Connect to the Socket.io server
// Make sure this URL matches your server's address and port
const socket = io('http://localhost:5000');

function App() {
  const [message, setMessage] = useState('');
  const [receivedMessage, setReceivedMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Event listener for connection
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('🔗 Connected to Socket.IO server!');
    });

    // Event listener for disconnection
    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('💔 Disconnected from Socket.IO server.');
    });

    // Event listener for 'response_message' from the server
    socket.on('response_message', (data) => {
      setReceivedMessage(data);
      console.log(`Server response: ${data}`);
    });

    // Clean up on component unmount
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('response_message');
    };
  }, []); // Run once on component mount

  const sendMessage = () => {
    if (message.trim()) {
      socket.emit('test_message', message); // Emit 'test_message' to the server
      setMessage(''); // Clear input
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Real-Time Communication with Socket.io</h1>
        <p>Connection Status: {isConnected ? '✅ Connected' : '❌ Disconnected'}</p>

        <div className="chat-interface">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
          />
          <button onClick={sendMessage} disabled={!isConnected}>
            Send Message
          </button>
        </div>

        {receivedMessage && (
          <div className="received-message">
            <p><strong>Server Says:</strong> {receivedMessage}</p>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;

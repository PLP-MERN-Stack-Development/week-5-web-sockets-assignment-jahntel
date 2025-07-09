import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { io } from 'socket.io-client';
import { MessageSquare, Users, Send, Smile, BellRing, Volume2, MessageSquareText, ThumbsUp, Heart, Laugh, ChevronDown, ChevronUp } from 'lucide-react';

// Define the Socket.io server URL. You will need to set up a Node.js server at this address.
// For example: http://localhost:3001
const SOCKET_SERVER_URL = 'http://localhost:3001';

// Firebase configuration and app ID are provided by the environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

// Initialize Firebase outside the component to prevent re-initialization
let app;
let db;
let auth;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (error) {
  console.error("Firebase initialization error:", error);
  // Fallback or error handling if Firebase fails to initialize
}

// Helper function to format timestamp
const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Notification sound
const notificationSound = new Audio('https://www.soundjay.com/buttons/beep-07.mp3'); // A simple beep sound

const App = () => {
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState('');
  const [inputUsername, setInputUsername] = useState('');
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [onlineUsers, setOnlineUsers] = useState({}); // { userId: { username, status } }
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [currentRoom, setCurrentRoom] = useState('global'); // 'global' or 'private:userId'
  const [activePrivateChatUser, setActivePrivateChatUser] = useState(null); // userId of the user in private chat
  const [socket, setSocket] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showReactions, setShowReactions] = useState(null); // Message ID for which reactions are shown
  const [showOnlineUsers, setShowOnlineUsers] = useState(true);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // --- Firebase Authentication and Setup ---
  useEffect(() => {
    const setupFirebase = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Firebase authentication error:", error);
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        // Try to load username from Firestore or prompt if new user
        const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/data`);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists() && userDocSnap.data().username) {
          setUsername(userDocSnap.data().username);
          setInputUsername(userDocSnap.data().username);
        }
        setIsAuthReady(true);
      } else {
        setUserId(null);
        setUsername('');
        setInputUsername('');
        setIsAuthReady(true);
      }
    });

    setupFirebase();

    return () => unsubscribeAuth();
  }, []);

  // --- Socket.io Connection and Event Listeners ---
  useEffect(() => {
    if (!isAuthReady || !userId || !username) return; // Wait for auth and username

    const newSocket = io(SOCKET_SERVER_URL, {
      query: { userId, username },
      transports: ['websocket', 'polling'] // Ensure compatibility
    });
    setSocket(newSocket);

    // Socket.io Event Listeners
    newSocket.on('connect', () => {
      console.log('Connected to Socket.io server');
      // Emit user online status to server
      newSocket.emit('userOnline', { userId, username });
      // Join the current room (global or private)
      newSocket.emit('joinRoom', currentRoom);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from Socket.io server');
      // Emit user offline status to server
      newSocket.emit('userOffline', { userId, username });
    });

    newSocket.on('message', (msg) => {
      console.log('Received message:', msg);
      setMessages((prevMessages) => [...prevMessages, msg]);
      if (msg.senderId !== userId) { // Play sound only if not self-sent
        notificationSound.play().catch(e => console.error("Sound play error:", e));
        showBrowserNotification(msg.senderName, msg.text);
      }
      // Send read receipt if it's a private message or in the active room
      if (msg.room === currentRoom && msg.senderId !== userId) {
        newSocket.emit('readReceipt', { messageId: msg.id, readerId: userId, readerName: username });
      }
    });

    newSocket.on('privateMessage', (msg) => {
      console.log('Received private message:', msg);
      setMessages((prevMessages) => [...prevMessages, msg]);
      if (msg.senderId !== userId) {
        notificationSound.play().catch(e => console.error("Sound play error:", e));
        showBrowserNotification(`Private from ${msg.senderName}`, msg.text);
      }
      // Send read receipt for private messages
      if (msg.senderId === activePrivateChatUser && msg.senderId !== userId) {
        newSocket.emit('readReceipt', { messageId: msg.id, readerId: userId, readerName: username });
      }
    });

    newSocket.on('onlineUsers', (users) => {
      setOnlineUsers(users);
    });

    newSocket.on('userOnline', (user) => {
      setOnlineUsers((prev) => ({ ...prev, [user.userId]: { username: user.username, status: 'online' } }));
      setMessages((prev) => [...prev, { type: 'notification', text: `${user.username} has joined the chat.`, timestamp: new Date() }]);
    });

    newSocket.on('userOffline', (user) => {
      setOnlineUsers((prev) => {
        const newUsers = { ...prev };
        if (newUsers[user.userId]) {
          newUsers[user.userId].status = 'offline'; // Mark as offline instead of deleting
        }
        return newUsers;
      });
      setMessages((prev) => [...prev, { type: 'notification', text: `${user.username} has left the chat.`, timestamp: new Date() }]);
    });

    newSocket.on('typing', ({ userId: typingUserId, username: typingUsername }) => {
      if (typingUserId !== userId) {
        setTypingUsers((prev) => new Set(prev).add(typingUsername));
      }
    });

    newSocket.on('stopTyping', ({ userId: typingUserId, username: typingUsername }) => {
      if (typingUserId !== userId) {
        setTypingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(typingUsername);
          return newSet;
        });
      }
    });

    newSocket.on('readReceipt', ({ messageId, readerId, readerName }) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId
            ? { ...msg, readBy: [...(msg.readBy || []), { userId: readerId, username: readerName }] }
            : msg
        )
      );
    });

    newSocket.on('messageReaction', ({ messageId, reaction, reactorId, reactorName }) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                reactions: {
                  ...(msg.reactions || {}),
                  [reaction]: [...new Set([...(msg.reactions?.[reaction] || []), reactorName])] // Add reactorName, ensure uniqueness
                }
              }
            : msg
        )
      );
    });

    // Clean up on unmount
    return () => {
      newSocket.disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [isAuthReady, userId, username, currentRoom, activePrivateChatUser]); // Reconnect if userId or username changes

  // --- Firestore Message Listener ---
  useEffect(() => {
    if (!isAuthReady || !db || !userId) return;

    let q;
    if (currentRoom === 'global') {
      q = query(collection(db, `artifacts/${appId}/public/data/messages`), orderBy('timestamp', 'asc'));
    } else if (currentRoom.startsWith('private:')) {
      const otherUserId = currentRoom.split(':')[1];
      // For private messages, we need to query messages where sender and receiver are both current user and other user
      // This requires a more complex query or fetching all and filtering, or a specific private chat collection.
      // For simplicity, we'll fetch all private messages and filter in client or use a combined ID for collection.
      // A better approach for private chats is to have a collection for each chat, e.g., chats/{user1Id}_{user2Id}/messages
      // For now, let's assume private messages are handled primarily via Socket.io and not persisted in a shared public collection.
      // If persisting, you'd need a robust schema for private chats.
      // For demonstration, we'll rely on Socket.io for immediate private messages.
      // For persistence, you'd create a collection like `private_chats/{chatId}/messages` where `chatId` is a sorted combination of user IDs.
      console.warn("Firestore persistence for private messages is not fully implemented in this demo. Relying on Socket.io for real-time delivery.");
      setMessages([]); // Clear messages when switching to private, as they are not fetched from Firestore this way
      return; // Do not set up snapshot listener for private chats in this simplified Firestore setup
    }

    if (q) {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedMessages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date(), // Ensure Date object
        }));
        setMessages(fetchedMessages);
      }, (error) => {
        console.error("Error fetching messages from Firestore:", error);
      });
      return () => unsubscribe();
    }
  }, [isAuthReady, db, userId, currentRoom]);

  // --- Scroll to bottom of messages ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // --- User Profile (Username) Management ---
  const handleSetUsername = async () => {
    if (!inputUsername.trim() || !userId) return;
    setUsername(inputUsername.trim());
    try {
      const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);
      await setDoc(userDocRef, { username: inputUsername.trim(), userId: userId }, { merge: true });
      console.log("Username saved to Firestore:", inputUsername.trim());
      // Reconnect socket with new username
      if (socket) {
        socket.disconnect();
        socket.connect();
      }
    } catch (error) {
      console.error("Error saving username to Firestore:", error);
    }
  };

  // --- Message Sending ---
  const sendMessage = async () => {
    if (!messageInput.trim() || !socket || !userId || !username) return;

    const messageData = {
      senderId: userId,
      senderName: username,
      text: messageInput.trim(),
      timestamp: serverTimestamp(), // Use server timestamp for consistency
      room: currentRoom,
      readBy: [],
      reactions: {}
    };

    if (currentRoom === 'global') {
      socket.emit('sendMessage', messageData);
      // Also add to Firestore for persistence
      try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/messages`), messageData);
      } catch (error) {
        console.error("Error adding message to Firestore:", error);
      }
    } else if (currentRoom.startsWith('private:')) {
      const recipientId = currentRoom.split(':')[1];
      socket.emit('privateMessage', { ...messageData, recipientId });
    }

    setMessageInput('');
    sendTypingStatus(false); // Stop typing after sending message
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // --- Typing Indicator ---
  const sendTypingStatus = useCallback((isTyping) => {
    if (!socket || !userId || !username) return;
    if (isTyping) {
      socket.emit('typing', { userId, username, room: currentRoom });
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingStatus(false);
      }, 3000); // Stop typing after 3 seconds of inactivity
    } else {
      socket.emit('stopTyping', { userId, username, room: currentRoom });
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  }, [socket, userId, username, currentRoom]);

  const handleMessageInputChange = (e) => {
    setMessageInput(e.target.value);
    if (e.target.value.length > 0) {
      sendTypingStatus(true);
    } else {
      sendTypingStatus(false);
    }
  };

  // --- Room Management ---
  const joinRoom = (roomName) => {
    if (socket && currentRoom !== roomName) {
      socket.emit('leaveRoom', currentRoom);
      setCurrentRoom(roomName);
      setActivePrivateChatUser(null);
      socket.emit('joinRoom', roomName);
      setMessages([]); // Clear messages when switching rooms, new messages will load from Firestore/Socket.io
      setTypingUsers(new Set()); // Clear typing users for the new room
    }
  };

  const startPrivateChat = (targetUserId) => {
    if (targetUserId === userId) {
      alert("You cannot start a private chat with yourself."); // Using alert for simplicity, replace with custom modal
      return;
    }
    const privateRoomId = `private:${targetUserId}`;
    if (socket && currentRoom !== privateRoomId) {
      socket.emit('leaveRoom', currentRoom);
      setCurrentRoom(privateRoomId);
      setActivePrivateChatUser(targetUserId);
      socket.emit('joinRoom', privateRoomId);
      setMessages([]); // Clear messages when switching to private chat
      setTypingUsers(new Set()); // Clear typing users for the new room
    }
  };

  // --- Browser Notifications ---
  const showBrowserNotification = (title, body) => {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body });
        }
      });
    }
  };

  // --- Message Reactions ---
  const toggleReactions = (messageId) => {
    setShowReactions(showReactions === messageId ? null : messageId);
  };

  const sendReaction = (messageId, reaction) => {
    if (socket && userId && username) {
      socket.emit('messageReaction', { messageId, reaction, reactorId: userId, reactorName: username });
      toggleReactions(null); // Hide reactions after sending
    }
  };

  // --- Render Logic ---
  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <div className="flex flex-col items-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100"></div>
          <p className="mt-4 text-lg">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (!username) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <div className="flex flex-col items-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-4 text-center">Welcome to Chat!</h2>
          <p className="mb-4 text-center">Please enter your username to continue.</p>
          <input
            type="text"
            className="w-full p-3 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="Your username"
            value={inputUsername}
            onChange={(e) => setInputUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSetUsername()}
          />
          <button
            onClick={handleSetUsername}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          >
            Join Chat
          </button>
        </div>
      </div>
    );
  }

  const currentChatName = currentRoom === 'global'
    ? 'Global Chat'
    : activePrivateChatUser && onlineUsers[activePrivateChatUser]
      ? `Private with ${onlineUsers[activePrivateChatUser].username}`
      : 'Private Chat';

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-inter">
      {/* Sidebar */}
      <div className={`flex-shrink-0 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 flex flex-col transition-all duration-300 ease-in-out ${showOnlineUsers ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:static absolute z-20 h-full'}`}>
        <h3 className="text-xl font-bold mb-4 flex items-center">
          <MessageSquare className="mr-2" size={20} /> Rooms
        </h3>
        <ul className="space-y-2 mb-6">
          <li>
            <button
              onClick={() => joinRoom('global')}
              className={`w-full text-left p-2 rounded-lg flex items-center transition duration-200 ${currentRoom === 'global' ? 'bg-blue-100 dark:bg-blue-700 text-blue-800 dark:text-blue-100 font-semibold' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <MessageSquareText className="mr-2" size={18} /> Global Chat
            </button>
          </li>
        </ul>

        <h3 className="text-xl font-bold mb-4 flex items-center">
          <Users className="mr-2" size={20} /> Online Users
          <button
            className="ml-auto p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 md:hidden"
            onClick={() => setShowOnlineUsers(!showOnlineUsers)}
          >
            {showOnlineUsers ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </h3>
        <ul className="flex-grow overflow-y-auto space-y-2">
          {Object.entries(onlineUsers).map(([id, user]) => (
            <li key={id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              <div className="flex items-center">
                <span className={`w-3 h-3 rounded-full mr-2 ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                <span className="font-medium">{user.username} {id === userId && '(You)'}</span>
              </div>
              {id !== userId && (
                <button
                  onClick={() => startPrivateChat(id)}
                  className="ml-2 px-3 py-1 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded-full transition duration-200"
                >
                  Chat
                </button>
              )}
            </li>
          ))}
        </ul>
  

Real-Time Chat Application with Socket.io
🚀 Objective: This project is a personal endeavor to build a real-time chat application using Socket.io. It serves as a demonstration of bidirectional communication between clients and a server, implementing core features like live messaging, connection status updates, and laying the groundwork for more advanced functionalities.

🌟 Features Implemented
Task 1: Project Setup (Completed)
Node.js Express Server: Established a robust backend using Node.js and Express.

Socket.io Integration (Server): Configured Socket.io on the server for real-time communication.

React Frontend: Developed a responsive user interface with React.

Socket.io Integration (Client): Set up the Socket.io client within the React application.

Basic Connection: Successfully established and demonstrated a basic bidirectional connection, allowing for a test message exchange between the client and server.

Future Enhancements (Planned)
User Authentication: Implement a simple username-based system for identifying users.

Global Chat Room: Create a public chat area where all connected users can communicate.

Message Display: Show messages with sender names and timestamps.

Typing Indicators: Display when users are actively typing.

Online/Offline Status: Track and show the connection status of users.

Private Messaging: Enable one-on-one private conversations between users.

Multiple Chat Rooms: Allow users to join different channels or rooms.

File/Image Sharing: Implement functionality for sending files or images.

Read Receipts & Reactions: Add features like message read receipts and reactions (e.g., likes).

Real-Time Notifications: Send notifications for new messages, user joins/leaves, and unread counts (with sound and browser notifications).

Performance & UX: Optimize message loading (pagination), handle disconnections gracefully, and ensure responsive design across devices.

🛠️ Getting Started
Follow these steps to run the application on your local machine.

Prerequisites
Node.js (v18+ recommended): Download and install it from nodejs.org.
You can verify your installation by running:

Bash

node -v
npm -v
Installation
Clone the Repository:

Bash

git clone <YOUR_REPOSITORY_URL> # Replace with your actual repository URL
cd real-time-chat-app # Navigate into the project directory
Server Setup:
Navigate into the server directory and install the necessary Node.js packages.

Bash

cd server
npm install
Client Setup:
Open a new terminal window. Navigate back to the project's root directory, then into the client directory, and install its dependencies.

Bash

cd ../client
npm install
Running the Application
You'll need two separate terminal windows open, one for the server and one for the client.

Start the Server:
In the terminal where you set up the server (i.e., you are in the server directory):

Bash

npm run dev
The server will start on http://localhost:5000.

Start the Client (React App):
In the terminal where you set up the client (i.e., you are in the client directory):

Bash

npm start # Or 'npm run dev' if you used Vite for the client setup
The React application will typically open in your web browser at http://localhost:3000.

Verification
Once both are running:

Check your server's terminal for "⚡️ User connected: 

Check your browser's developer console (F12) for "🔗 Connected to Socket.IO server!" messages.

Type a message in the input field on the web page and click "Send Message" to observe the bidirectional communication in both the browser and server consoles.


🤝 Connect with Me
This is a personal project. Feel free to explore the code.


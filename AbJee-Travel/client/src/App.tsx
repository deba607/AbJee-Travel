import './App.css'
import { ThemeProvider } from './components/mvpblocks/theme-provider'
import { AuthProvider } from './contexts/AuthContext'
import Home from './Pages/HomePage';
import LandingPage from './Pages/LandingPage'
import ChatPage from './Pages/ChatPage';
import AuthPage from './Pages/AuthPage';
import ChatRoom from './components/chat/ChatRoom';
import {BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'


function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path='/home' element={<Home/>} />
            <Route path='/auth' element={<AuthPage />} />
            <Route path='/chat' element={<ChatPage />}>
              <Route path='room/:roomId' element={<ChatRoom />} />
            </Route>
            <Route path="/test" element={
              <div style={{padding: '20px'}}>
                <h1>Test Route Works!</h1>
                <Link to="/">Back to Home</Link>
                <br />
                <Link to="/chat">Go to Chat</Link>
              </div>
            } />
            {/* <Route path="/about" element={<div><AboutPage /></div>} /> */}
            {/* <Route path="/contact" element={<ContactPage />} /> */}
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

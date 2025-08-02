import './App.css'
import { ThemeProvider } from './components/mvpblocks/theme-provider'
import Home from './Pages/HomePage';
import LandingPage from './Pages/LandingPage'
import {BrowserRouter as Router, Routes, Route } from 'react-router-dom'


function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path='/home' element={<Home/>} />
          {/* <Route path="/about" element={<div><AboutPage /></div>} /> */}
          {/* <Route path="/contact" element={<ContactPage />} /> */}
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;

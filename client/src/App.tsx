import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Header1 from './components/mvpblocks/header-1'
import React, { useEffect } from 'react';
import ThemeToggle from './components/mvpblocks/ThemeToggle';
import Globe1 from './components/mvpblocks/globe1'
import SimplePricing from './components/mvpblocks/simple-pricing'

function App() {
  const [count, setCount] = useState(0)

 useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const html = document.documentElement;

    if (savedTheme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, []);

  return (
   <>
   <Header1 />
   <Globe1/>
   <ThemeToggle/>
   <SimplePricing/>
   </>
  );
}

export default App;

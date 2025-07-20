import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Header1 from './components/mvpblocks/header-1'
import React, { useEffect } from 'react';
import ThemeToggle from './components/mvpblocks/ThemeToggle';
import Globe1 from './components/mvpblocks/globe1'
import SimplePricing from './components/mvpblocks/simple-pricing'
import CardCarousel from "@/components/ui/card-carousel"
import { Switch } from "@/components/ui/switch"
import { FeatureBlock3 } from './components/mvpblocks/feature'
import { ThemeProvider } from './components/mvpblocks/theme-provider'
import { ModeToggle } from './components/mvpblocks/mode-toggle'
import MultiStepForm from './components/ui/multi-step-form'

function App() {
  const [count, setCount] = useState(0)
  const [switchChecked, setSwitchChecked] = useState(false)

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
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Header1 />
 
      {/* <Globe1/> */}
      
      <CardCarousel
        images={[
          { src: "/img1.png", alt: "Image 1" },
          { src: "/img2.png", alt: "Image 2" },
          { src: "/img3.png", alt: "Image 3" },
          { src: "/img4.png", alt: "Image 3" },
          { src: "/img5.png", alt: "Image 3" },
          { src: "/img6.jpg", alt: "Image 3" },
          { src: "/img7.jpg", alt: "Image 3" },
          { src: "/img8.jpg", alt: "Image 3" },
        ]}
        autoplayDelay={2000}
        showPagination={true}
        showNavigation={true}
      />
      <FeatureBlock3/>
      <SimplePricing/>
      
    </ThemeProvider>
  );
}

export default App;

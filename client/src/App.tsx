import './App.css'
import Header1 from './components/mvpblocks/header-1'
import SimplePricing from './components/mvpblocks/simple-pricing'
import CardCarousel from "@/components/ui/card-carousel"
import { FeatureBlock3 } from './components/mvpblocks/feature'
import { ThemeProvider } from './components/mvpblocks/theme-provider'
import GradientTypewriter from './components/mvpblocks/gradient-typewriter'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Header1 />
      <GradientTypewriter/>
      <section className="w-full">
        <video
          src="/video1.mp4" //add video link here..
          className="w-full h-[60vw] max-h-[600px] object-cover pt-2"
          autoPlay
          loop
          muted
          controls
        >
          
        </video>
      </section>
 
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
      <div id="pricing">
        <SimplePricing/>
      </div>
      
    </ThemeProvider>
  );
}

export default App;

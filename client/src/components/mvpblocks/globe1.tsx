import Earth from '../ui/globe';

export default function Globe1() {
  return (
    <>
      <div className="flex flex-col items-center justify-center overflow-hidden bg-background">
        <article className="relative mx-auto my-8 max-w-[500px] rounded-xl border border-border p-5 text-center">
          <div className="relative z-10">
            <h1 className="text-7xl font-semibold leading-[100%] tracking-tighter">
              Welcome to ABjee Travel
            </h1>
            {/* Normalized RGB values i.e (RGB or color / 255) */}
          <Earth
  mapBrightness={5.5}
  baseColor={[0.4, 0.6509, 1]}         // natural blue for oceans
  markerColor={[0.05, 0.8, 0.2]}       // soft green for markers (land/forest tone)
  glowColor={[0.2, 0.4, 0.9]}          // cool blue glow for atmosphere effect
/>



          </div>
        </article>
      </div>
    </>
  );
}

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
  baseColor={[0.6, 1, 0.6]}        // soft light green
  markerColor={[0.7, 1, 0.7]}      // slightly brighter markers
  glowColor={[0.6, 1, 0.6]}        // gentle green glow
/>


          </div>
        </article>
      </div>
    </>
  );
}

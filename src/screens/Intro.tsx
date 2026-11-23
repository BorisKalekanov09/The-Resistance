export default function Intro({ onBegin }: { onBegin: () => void }) {
  return (
    <section className="screen intro">
      <div className="intro-mark" aria-hidden>
        <svg viewBox="0 0 400 400">
          {Array.from({ length: 9 }).map((_, i) => (
            <ellipse key={i} cx="200" cy="200" rx={60 + i * 17} ry={44 + i * 13} className="contour" style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
          <circle cx="226" cy="176" r="4" className="contour-dot" />
        </svg>
      </div>
      <div className="intro-inner">
        <p className="label reveal-1">The Resistance</p>
        <p className="subtitle reveal-2">A simulation of effort, decisions and the brain.</p>
        <h1 className="display reveal-3">
          Why is doing the
          <br />
          difficult thing so hard?
        </h1>
        <p className="lede reveal-4">
          Your brain constantly weighs effort against reward. Explore what happens when you choose to act — or avoid it.
        </p>
        <button className="btn btn-primary reveal-5" onClick={onBegin}>
          Begin
        </button>
        <p className="fine reveal-5">Three questions ·Illustrative model · No data leaves your browser</p>
      </div>
    </section>
  );
}

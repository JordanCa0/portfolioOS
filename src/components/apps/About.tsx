export default function About() {
  return (
    <div className="flex flex-col items-center gap-5 p-8 text-center">
      <img
        src={`${import.meta.env.BASE_URL}icon.png`}
        alt="Jordan Cao"
        width={96}
        height={96}
        className="h-24 w-24 dark:invert"
      />
      <div>
        <h1 className="text-2xl font-bold">Jordan Cao</h1>
        <p className="text-sm text-accent-soft">
          Software Engineer · CS @ Wilfrid Laurier · Boba Enjoyer
        </p>
      </div>
      <p className="max-w-md text-sm leading-relaxed text-body-muted">
        I'm a computer science student at Wilfrid Laurier University, most
        recently a software engineering intern at Mercury working on a
        large-scale Haskell fintech backend. I've also done machine learning
        research with evolutionary algorithms and medical imaging, and built
        GTOtutor, a poker trainer with a Rust solver and a Claude-powered coach.
        I like type systems, clean abstractions, and software that feels good
        to use, like this desktop you're clicking around in.
      </p>
      <p className="text-xs text-body-muted">
        Open the terminal and type{' '}
        <span className="text-term-green">help</span> to explore.
      </p>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  id?: string;
}) {
  return (
    <header className="mb-10 text-center">
      {eyebrow ? (
        <p className="mb-3 text-xs tracking-[0.25em] text-gold-deep uppercase">{eyebrow}</p>
      ) : null}
      <h2 id={id} className="font-serif text-3xl text-brown sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted">{description}</p>
      ) : null}
    </header>
  );
}

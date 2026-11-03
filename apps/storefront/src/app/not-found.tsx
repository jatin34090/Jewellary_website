import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-28 text-center">
      <p className="text-xs tracking-[0.25em] text-gold-deep uppercase">Page not found</p>
      <h1 className="mt-4 font-serif text-4xl text-brown">This piece has moved on.</h1>
      <p className="mt-4 text-sm text-muted">
        The page you are looking for does not exist or is no longer available.
      </p>
      <Link
        href="/shop"
        className="mt-10 inline-flex rounded bg-brown px-8 py-3.5 text-sm tracking-[0.15em] text-cream uppercase hover:bg-brown-soft"
      >
        Back to the collection
      </Link>
    </div>
  );
}

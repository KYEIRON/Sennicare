/**
 * An honest placeholder.
 *
 * BOYD'S does not build mockups that imply working functionality. Each of the
 * three surfaces is wired and routable from Phase 1, and each says plainly what
 * it will do and which phase delivers it. Nothing here displays invented data.
 */
export function PhasePlaceholder({
  surface,
  headline,
  phase,
  description,
}: Readonly<{
  surface: string;
  headline: string;
  phase: string;
  description: string;
}>) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold tracking-[0.2em] text-boyd-orange-500 uppercase">
        BOYD&rsquo;S Logistics LLC
      </p>
      <h1 className="mt-3 text-3xl font-bold text-boyd-light-50 sm:text-4xl">
        {headline}
      </h1>
      <p className="mt-6 text-lg text-boyd-light-300">{description}</p>

      <div className="mt-10 rounded-lg border border-boyd-navy-700 bg-boyd-navy-900 p-5">
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-2 w-2 rounded-full bg-boyd-unavailable"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold tracking-wide text-boyd-light-400 uppercase">
            Not yet built
          </span>
        </div>
        <p className="mt-3 text-sm text-boyd-light-400">
          <span className="font-semibold text-boyd-light-300">{surface}</span> is
          scheduled for <span className="font-semibold text-boyd-blue-300">{phase}</span>.
          This page is a routing placeholder — it deliberately shows no data rather than
          sample figures that could be mistaken for real business information.
        </p>
      </div>
    </main>
  );
}

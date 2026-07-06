/**
 * The one signature ornament: "Slate" set in the display weight, with
 * a hand-drawn chalk-stroke underline — the mark chalk leaves on a
 * slate board. Used on the Connect/Login/Setup screens only; the
 * worked app stays quiet and doesn't repeat it.
 */
export function Wordmark({ size = 'lg' }: { size?: 'md' | 'lg' }) {
  return (
    <div className="inline-flex flex-col items-center">
      <span
        className={
          (size === 'lg' ? 'text-[30px]' : 'text-[22px]') +
          ' font-semibold tracking-tight text-text'
        }
      >
        Slate
      </span>
      <svg
        width="76"
        height="10"
        viewBox="0 0 76 10"
        fill="none"
        className="-mt-0.5 text-accent"
        aria-hidden="true"
      >
        <path
          d="M2 6.5C15 2.8 27 8.6 39 5C51 1.4 62 6.4 74 3.2"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

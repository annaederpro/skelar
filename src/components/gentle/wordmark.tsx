export function Wordmark() {
  return (
    <span
      className="flex items-center font-heading text-[19px] font-semibold tracking-tight"
      aria-label="coralQ"
    >
      coral
      <svg
        width="24"
        height="29"
        viewBox="0 0 100 120"
        fill="none"
        className="relative top-1"
        aria-hidden
      >
        <circle cx="46" cy="46" r="29" stroke="#3E8E9C" strokeWidth="13" />
        <g stroke="#E08363" strokeWidth="12" strokeLinecap="round">
          <path d="M60 60 L72 74" />
          <path d="M72 74 L85 70" />
          <path d="M72 74 L79 90" />
        </g>
        <circle cx="70" cy="24" r="5.5" fill="#8FC6CD" />
      </svg>
    </span>
  );
}

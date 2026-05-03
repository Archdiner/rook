export function Logo({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="currentColor" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
      style={style}
    >
      {/* Central large circle */}
      <circle cx="50" cy="50" r="16" />

      {/* Inner orbit */}
      <circle cx="28" cy="45" r="3" />
      <circle cx="35" cy="28" r="2.5" />
      <circle cx="58" cy="25" r="2" />
      <circle cx="75" cy="42" r="3" />
      <circle cx="68" cy="65" r="2.5" />
      <circle cx="48" cy="72" r="1.5" />
      <circle cx="35" cy="60" r="2" />

      {/* Middle orbit */}
      <circle cx="22" cy="55" r="4.5" />
      <circle cx="25" cy="32" r="5" />
      <circle cx="45" cy="15" r="4" />
      <circle cx="65" cy="18" r="6" />
      <circle cx="85" cy="32" r="4" />
      <circle cx="80" cy="55" r="5" />
      <circle cx="58" cy="80" r="4" />
      <circle cx="35" cy="78" r="3.5" />

      {/* Outer scatter */}
      <circle cx="12" cy="45" r="4" />
      <circle cx="10" cy="30" r="1.5" />
      <circle cx="15" cy="65" r="2" />
      <circle cx="22" cy="85" r="4.5" />
      <circle cx="40" cy="90" r="1.5" />
      <circle cx="55" cy="88" r="3" />
      <circle cx="75" cy="88" r="2" />
      <circle cx="85" cy="75" r="3.5" />
      <circle cx="95" cy="48" r="1.5" />
      <circle cx="78" cy="22" r="2" />
      <circle cx="50" cy="8" r="2" />
      <circle cx="30" cy="12" r="3" />
    </svg>
  );
}

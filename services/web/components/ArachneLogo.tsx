import React from "react";

type ArachneLogoProps = React.SVGProps<SVGSVGElement>;

export default function ArachneLogo(props: ArachneLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 420 120"
      role="img"
      aria-labelledby="title desc"
      {...props}
    >
      <title id="title">Arachne logo</title>
      <desc id="desc">
        Futuristic wordmark logo for Arachne with a minimal spider web motif
      </desc>

      <defs>
        <linearGradient id="arachneGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="50%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>

        <filter id="arachneGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <style>{`
          @keyframes draw {
            0% {
              stroke-dashoffset: 140;
              opacity: 0;
            }
            50% {
              opacity: 1;
            }
            100% {
              stroke-dashoffset: 0;
              opacity: 1;
            }
          }

          @keyframes glowPulse {
            0%   { filter: drop-shadow(0 0 4px rgba(148, 0, 255, 0.4)); }
            50%  { filter: drop-shadow(0 0 10px rgba(148, 0, 255, 0.75)); }
            100% { filter: drop-shadow(0 0 4px rgba(148, 0, 255, 0.4)); }
          }

          .web-arc {
            stroke-dasharray: 140;
            animation: draw 2.2s ease forwards;
          }

          .web-arc.secondary {
            animation-delay: 0.35s;
          }

          .web-leg {
            stroke-dasharray: 120;
            animation: draw 1.6s ease forwards;
            animation-delay: 0.15s;
          }

          .arachne-text-animated {
            animation: glowPulse 3.5s ease-in-out infinite;
          }
        `}</style>
      </defs>

      <rect width="100%" height="100%" fill="transparent" />

      <text
        x="50%"
        y="54%"
        textAnchor="middle"
        fill="url(#arachneGradient)"
        fontSize={42}
        fontFamily="'Oxanium', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontWeight={700}
        letterSpacing="0.12em"
        className="arachne-text-animated"
        style={{ textTransform: "uppercase" }}
      >
        Arachne
      </text>

      <g transform="translate(0,10)">
        <g opacity="0.8" stroke="#4F46E5" strokeWidth={1.2} strokeLinecap="round">
          <line x1="80" y1="70" x2="40" y2="105" className="web-leg" />
          <line x1="130" y1="70" x2="110" y2="112" className="web-leg" />
          <line x1="210" y1="70" x2="210" y2="115" className="web-leg" />
          <line x1="290" y1="70" x2="310" y2="112" className="web-leg" />
          <line x1="340" y1="70" x2="380" y2="105" className="web-leg" />
        </g>

        <path
          fill="none"
          stroke="#6B21A8"
          strokeWidth={1}
          strokeLinecap="round"
          d="M60,98 Q210,60 360,98"
          opacity="0.7"
          className="web-arc"
        />
        <path
          fill="none"
          stroke="#6B21A8"
          strokeWidth={1}
          strokeLinecap="round"
          d="M75,110 Q210,78 345,110"
          opacity="0.45"
          className="web-arc secondary"
        />
      </g>
    </svg>
  );
}


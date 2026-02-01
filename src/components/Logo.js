import React from 'react';


const Logo = () => (
  <svg className="eleanordle-logo" viewBox="0 0 220 50" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Eleanordle">
    <title>Eleanordle</title>
    <defs>
      <linearGradient id="eleanordle-gradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ff5f6d" />
        <stop offset="50%" stopColor="#ffc371" />
        <stop offset="100%" stopColor="#47caff" />
      </linearGradient>
      <filter id="eleanordle-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#222" floodOpacity="0.35" />
      </filter>
    </defs>
    <text x="50%" y="36" textAnchor="middle" aria-hidden="true" fontFamily="'Baloo 2', 'Comic Sans MS', 'Segoe UI', Arial, sans-serif" fontWeight="bold" fontSize="32" filter="url(#eleanordle-shadow)">
      <tspan fill="url(#eleanordle-gradient)">Eleanordle</tspan>
    </text>
    <style>
      {`
        .eleanordle-logo {
          width: 100%;
          height: auto;
          max-width: 220px;
          display: block;
          margin: 0 auto;
        }
        @media (max-width: 600px) {
          .eleanordle-logo {
            max-width: 300px;
          }
        }
      `}
    </style>
  </svg>
);

export default Logo;

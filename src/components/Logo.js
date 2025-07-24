import React from 'react';

const Logo = () => (
  <svg className="eleanordle-logo" viewBox="0 0 220 50" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Eleanordle">
    <title>Eleanordle</title>
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
        .eleanordle-logo-eleanor {
          font-size: 24px;
          fill: #e91e63;
        }
        .eleanordle-logo-dle {
          font-size: 24px;
          /*font-weight: 700;*/
          fill: #9c627f98;
        }
      `}
    </style>
    <text x="50%" y="35" textAnchor="middle" aria-hidden="true">
      <tspan className="eleanordle-logo-eleanor">Eleanor</tspan>
      <tspan className="eleanordle-logo-dle" dx="-2">dle</tspan>
    </text>
  </svg>
);

export default Logo;

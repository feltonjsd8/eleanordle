import React from 'react';

const Logo = () => (
  <svg width="220" height="50" viewBox="0 0 220 50" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Eleanordle">
    <title>Eleanordle</title>
    <style>
      {`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Roboto:wght@700&display=swap');
        .eleanordle-logo-eleanor {
          font-family: 'Fredoka One', cursive;
          font-size: 28px;
          fill: #e91e63;
        }
        .eleanordle-logo-dle {
          font-family: 'Fredoka One', cursive;
          font-size: 28px;
          /*font-weight: 700;*/
          fill: #9c627f98;
        }
      `}
    </style>
    <text x="10" y="35" aria-hidden="true">
      <tspan className="eleanordle-logo-eleanor">Elean</tspan>
      <tspan className="eleanordle-logo-dle" dx="1">ordle</tspan>
    </text>
  </svg>
);

export default Logo;

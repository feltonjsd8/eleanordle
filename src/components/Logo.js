import React from 'react';

const TILES = [
  { letter: 'E', color: '#6aaa64' },
  { letter: 'L', color: '#c9b458' },
  { letter: 'E', color: '#6aaa64' },
  { letter: 'A', color: '#c9b458' },
  { letter: 'N', color: '#6aaa64' },
  { letter: 'O', color: '#c9b458' },
  { letter: 'R', color: '#6aaa64' },
  { letter: 'D', color: '#787c7e' },
  { letter: 'L', color: '#787c7e' },
  { letter: 'E', color: '#787c7e' },
];

const TILE_SIZE = 36;
const GAP = 4;
const TOTAL_WIDTH = TILES.length * TILE_SIZE + (TILES.length - 1) * GAP;
const HEIGHT = TILE_SIZE + 4;

const Logo = () => (
  <svg
    className="eleanordle-logo"
    viewBox={`0 0 ${TOTAL_WIDTH} ${HEIGHT}`}
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Eleanordle"
  >
    <title>Eleanordle</title>
    <style>
      {`
        .eleanordle-logo {
          width: 100%;
          height: auto;
          max-width: 400px;
          display: block;
          margin: 0 auto;
        }
        .eleanordle-logo-letter {
          font-size: 22px;
          font-weight: 700;
          font-family: 'Helvetica Neue', Arial, sans-serif;
          fill: white;
          dominant-baseline: central;
          text-anchor: middle;
        }
      `}
    </style>
    {TILES.map(({ letter, color }, i) => {
      const x = i * (TILE_SIZE + GAP);
      return (
        <g key={i} aria-hidden="true">
          <rect x={x} y={2} width={TILE_SIZE} height={TILE_SIZE} rx={4} fill={color} />
          <text
            className="eleanordle-logo-letter"
            x={x + TILE_SIZE / 2}
            y={2 + TILE_SIZE / 2}
          >
            {letter}
          </text>
        </g>
      );
    })}
  </svg>
);

export default Logo;

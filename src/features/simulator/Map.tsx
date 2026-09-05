import { Flag, Footprints, Star } from 'lucide-react';
import { RobotGlyph } from '../../components/Robot';
import { pointKey } from '../../engine/interpreter';
import type { Level, RunState } from '../../types';

export function MapBoard({
  level,
  state,
  trail,
  reducedMotion,
  speed,
}: {
  level: Level;
  state: RunState;
  trail: boolean;
  reducedMotion: boolean;
  speed: number;
}) {
  const cell = 80,
    pad = 30;
  const obstacles = new Set(level.obstacles.map(pointKey));
  const rotation = { N: 0, E: 90, S: 180, W: 270 }[state.robot.direction];
  return (
    <div className="map-area">
      <svg
        className="map-svg"
        viewBox={`0 0 ${level.width * cell + pad * 2} ${level.height * cell + pad * 2}`}
        role="img"
        aria-label={`机器人地图，${level.width} 行列宽、${level.height} 格高。机器人在 (${state.robot.x}, ${state.robot.y})，朝${{ N: '北', E: '东', S: '南', W: '西' }[state.robot.direction]}。`}
        data-testid="robot-map"
        data-x={state.robot.x}
        data-y={state.robot.y}
        data-direction={state.robot.direction}
      >
        <defs>
          <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#fff" />
            <stop offset="1" stopColor="#f6f9fe" />
          </linearGradient>
          <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#c6eacb" />
            <stop offset="1" stopColor="#acd9b6" />
          </linearGradient>
        </defs>
        {Array.from({ length: level.width }, (_, x) => (
          <text key={`x${x}`} x={pad + x * cell + cell / 2} y={17} className="map-coordinate">
            {x}
          </text>
        ))}
        {Array.from({ length: level.height }, (_, y) => (
          <text key={`y${y}`} x={13} y={pad + y * cell + cell / 2 + 5} className="map-coordinate">
            {y}
          </text>
        ))}
        {Array.from({ length: level.width * level.height }, (_, i) => {
          const x = i % level.width,
            y = Math.floor(i / level.width),
            key = `${x},${y}`,
            obstacle = obstacles.has(key);
          const start = x === level.start.x && y === level.start.y;
          return (
            <g key={key} transform={`translate(${pad + x * cell},${pad + y * cell})`}>
              <rect
                x="3"
                y="7"
                width="74"
                height="72"
                rx="12"
                fill={obstacle ? '#93c69f' : '#dce6f2'}
              />
              <rect
                x="3"
                y="3"
                width="74"
                height="72"
                rx="12"
                fill={obstacle ? 'url(#grass)' : start ? '#dfecff' : 'url(#tile)'}
                stroke={start ? '#9bc1f7' : obstacle ? '#afd4b7' : '#e2eaf4'}
                strokeWidth="1.5"
              />
              {start && (
                <rect
                  x="13"
                  y="13"
                  width="54"
                  height="52"
                  rx="10"
                  fill="none"
                  stroke="#a5c7f7"
                  strokeWidth="1.5"
                  strokeDasharray="4 5"
                />
              )}
              {obstacle && (
                <g>
                  <path d="M19 52 23 34 39 24 57 31 64 48 51 58 29 59Z" fill="#83ad90" />
                  <path d="M23 34 39 24 57 31 45 43 29 45Z" fill="#d9e7dc" />
                  <path d="M45 43 57 31 64 48 51 58Z" fill="#a4bfad" />
                  <path
                    d="M18 62l-3-7m47 8 4-6"
                    stroke="#70ae82"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </g>
              )}
            </g>
          );
        })}
        {trail && state.trail.length > 1 && (
          <polyline
            points={state.trail
              .map((p) => `${pad + p.x * cell + 40},${pad + p.y * cell + 40}`)
              .join(' ')}
            fill="none"
            stroke="#7aacf2"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1 13"
            opacity=".65"
          />
        )}
        {level.stars
          .filter((s) => !state.collected.includes(pointKey(s)))
          .map((star) => (
            <g
              key={pointKey(star)}
              transform={`translate(${pad + star.x * cell + 20},${pad + star.y * cell + 18})`}
            >
              <circle cx="20" cy="24" r="24" fill="#fff3c6" opacity=".8" />
              <path
                d="m20 2 6 13 14 2-10 10 2 14-12-7-12 7 2-14L0 17l14-2Z"
                fill="#ffc94d"
                stroke="#e9ae27"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path d="m19 9-4 9-7 1" stroke="#fff1aa" strokeWidth="3" strokeLinecap="round" />
            </g>
          ))}
        {level.goal && (
          <g
            transform={`translate(${pad + level.goal.x * cell + 21},${pad + level.goal.y * cell + 10})`}
          >
            <ellipse cx="17" cy="56" rx="17" ry="5" fill="#b2d3c8" opacity=".7" />
            <path d="M13 9v44" stroke="#55827a" strokeWidth="4" strokeLinecap="round" />
            <path d="M15 10h30l-6 10 6 10H15Z" fill="#54bc98" />
            <path
              d="m22 20 4 4 8-8"
              stroke="white"
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}
        <g
          key={`${level.id}-${state.status === 'idle' ? 'reset' : 'active'}`}
          style={{
            transform: `translate(${pad + state.robot.x * cell}px, ${pad + state.robot.y * cell}px)`,
            transition:
              reducedMotion || state.status === 'idle'
                ? 'none'
                : `transform ${Math.min(400, 400 / speed)}ms ease`,
          }}
        >
          <g transform={`rotate(${rotation} 40 40)`}>
            <RobotGlyph />
          </g>
        </g>
      </svg>
      <div className="map-legend">
        <span>
          <span className="start-marker" /> 起点
        </span>
        <span>
          <Star size={17} fill="#ffcf62" color="#d79b23" /> 星星
        </span>
        <span>
          <Flag size={17} color="#309b75" /> 终点
        </span>
        <span>
          <span className="obstacle-marker" /> 障碍物
        </span>
      </div>
      <div className="map-meta">
        <span>
          <Footprints size={15} /> 已执行 <b data-testid="action-count">{state.actions}</b> 个动作
        </span>
        <span>
          朝向 <b>{{ N: '↑ 北', E: '→ 东', S: '↓ 南', W: '← 西' }[state.robot.direction]}</b>
        </span>
      </div>
    </div>
  );
}

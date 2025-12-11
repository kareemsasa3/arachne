'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { assetUrl } from '@/lib/api';

interface Point {
  x: number;
  y: number;
}

interface Spider {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  path: Point[];
  pauseUntil: number;
}

type PersistedSpiderState = {
  spider: Spider | null;
  webPaths: Point[][];
};

declare global {
  // eslint-disable-next-line no-var
  var __spiderState: PersistedSpiderState | undefined;
}

export default function SpiderWebBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spider, setSpider] = useState<Spider | null>(null);
  const animationRef = useRef<number | null>(null);
  const webPathsRef = useRef<Point[][]>([]);
  const spiderRef = useRef<Spider | null>(null);
  const [imageError, setImageError] = useState(false);

  const spawnSpider = () => {
    const edge = Math.floor(Math.random() * 4);
    let x: number;
    let y: number;

    switch (edge) {
      case 0:
        x = Math.random() * window.innerWidth;
        y = -50;
        break;
      case 1:
        x = window.innerWidth + 50;
        y = Math.random() * window.innerHeight;
        break;
      case 2:
        x = Math.random() * window.innerWidth;
        y = window.innerHeight + 50;
        break;
      default:
        x = -50;
        y = Math.random() * window.innerHeight;
    }

    const nextSpider: Spider = {
      id: Date.now(),
      x,
      y,
      targetX: Math.random() * window.innerWidth,
      targetY: Math.random() * window.innerHeight,
      speed: 0.5 + Math.random() * 1,
      path: [],
      pauseUntil: performance.now() + 300,
    };

    spiderRef.current = nextSpider;
    setSpider(nextSpider);
    setImageError(false);
  };

  const updateTarget = (s: Spider) => {
    s.targetX = Math.random() * window.innerWidth;
    s.targetY = Math.random() * window.innerHeight;
    s.pauseUntil = performance.now() + 300 + Math.random() * 900;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      const now = performance.now();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw accumulated web paths
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 1;
      webPathsRef.current.forEach((path) => {
        if (path.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i += 1) {
          ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
      });

      const currentSpider = spiderRef.current;

      if (currentSpider && currentSpider.path.length > 1) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(currentSpider.path[0].x, currentSpider.path[0].y);
        for (let i = 1; i < currentSpider.path.length; i += 1) {
          ctx.lineTo(currentSpider.path[i].x, currentSpider.path[i].y);
        }
        ctx.stroke();
      }

      if (currentSpider) {
        const dx = currentSpider.targetX - currentSpider.x;
        const dy = currentSpider.targetY - currentSpider.y;
        const distance = Math.hypot(dx, dy);

        // Skip movement while paused
        if (now < currentSpider.pauseUntil) {
          // keep trail drawing but do not move
        } else {
          if (distance < 30) {
            updateTarget(currentSpider);
          } else {
            currentSpider.x += (dx / distance) * currentSpider.speed;
            currentSpider.y += (dy / distance) * currentSpider.speed;

            if (
              currentSpider.path.length === 0 ||
              Math.abs(currentSpider.path[currentSpider.path.length - 1].x - currentSpider.x) > 10 ||
              Math.abs(currentSpider.path[currentSpider.path.length - 1].y - currentSpider.y) > 10
            ) {
              currentSpider.path.push({ x: currentSpider.x, y: currentSpider.y });
            }

            // Occasionally steer to a fresh target mid-route to avoid long straight runs
            if (Math.random() < 0.01) {
              updateTarget(currentSpider);
            }
          }

          // Occasionally pause mid-route
          if (Math.random() < 0.003) {
            currentSpider.pauseUntil = now + 300 + Math.random() * 700;
          }
        }

        spiderRef.current = currentSpider;
        setSpider({ ...currentSpider });
      } else {
        setSpider(null);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      globalThis.__spiderState = {
        spider: spiderRef.current
          ? { ...spiderRef.current, path: [...spiderRef.current.path] }
          : null,
        webPaths: webPathsRef.current.map((path) => path.map((p) => ({ ...p }))),
      };
    };
  }, []);

  useEffect(() => {
    const persisted = globalThis.__spiderState;
    if (persisted) {
      spiderRef.current = persisted.spider ? { ...persisted.spider, path: [...persisted.spider.path] } : null;
      webPathsRef.current = persisted.webPaths.map((path) => path.map((p) => ({ ...p })));
      setSpider(spiderRef.current ? { ...spiderRef.current } : null);
    } else {
      spawnSpider();
    }
  }, []);

  const handleSpiderClick = (e: React.MouseEvent) => {
    const currentSpider = spiderRef.current;
    if (!currentSpider) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const distance = Math.hypot(clickX - currentSpider.x, clickY - currentSpider.y);

    if (distance < 30) {
      if (currentSpider.path.length > 1) {
        webPathsRef.current.push([...currentSpider.path]);
        if (webPathsRef.current.length > 20) {
          webPathsRef.current.shift();
        }
      }

      setTimeout(spawnSpider, 500);
      spiderRef.current = null;
      setSpider(null);
    }
  };

  const rotationDeg =
    spider !== null
      ? Math.atan2(spider.targetY - spider.y, spider.targetX - spider.x) * (180 / Math.PI) + 90
      : 0;

  return (
    <div className="fixed inset-0 z-0">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full pointer-events-none"
      />
      {spider && !imageError && (
        <img
          src={assetUrl('/images/spider-placeholder.png')}
          alt="spider"
          className="pointer-events-auto absolute h-8 w-8 cursor-pointer transition-transform hover:scale-110"
          style={{
            left: spider.x - 16,
            top: spider.y - 16,
            transform: `rotate(${rotationDeg}deg)`,
          }}
          onClick={handleSpiderClick}
          onError={() => setImageError(true)}
        />
      )}
      {spider && imageError && (
        <div
          className="pointer-events-auto absolute h-8 w-8 cursor-pointer rounded-full bg-slate-200/70"
          style={{
            left: spider.x - 16,
            top: spider.y - 16,
            transform: `rotate(${rotationDeg}deg)`,
          }}
          onClick={handleSpiderClick}
        />
      )}
    </div>
  );
}


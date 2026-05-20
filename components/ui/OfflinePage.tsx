'use client'

import { useEffect, useRef } from 'react'
import { VERSION } from '@/lib/version'

export default function OfflinePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // ── Canvas Fractal Motif Rendering (Julia Set) ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const ctx: CanvasRenderingContext2D = context

    let animId: number
    let time = 0

    const width = canvas.width
    const height = canvas.height
    const imgData = ctx.createImageData(width, height)
    const data = imgData.data

    function draw() {
      // Slowly morph the complex constant C to animate the fractal structure
      const cr = -0.7 + Math.sin(time * 0.008) * 0.08
      const ci = 0.27015 + Math.cos(time * 0.012) * 0.08
      const maxIter = 28

      for (let y = 0; y < height; y++) {
        const zi_start = (y - height / 2) / (height / 2.3)
        for (let x = 0; x < width; x++) {
          let zr = (x - width / 2) / (width / 2.3)
          let zi = zi_start
          let iter = 0

          while (zr * zr + zi * zi < 4 && iter < maxIter) {
            const temp = zr * zr - zi * zi + cr
            zi = 2 * zr * zi + ci
            zr = temp
            iter++
          }

          const idx = (y * width + x) * 4
          
          if (iter === maxIter) {
            // Interior/core: deep dark nightfall green
            data[idx] = 8
            data[idx + 1] = 14
            data[idx + 2] = 8
            data[idx + 3] = 255
          } else {
            // Exterior: ethereal moonlight gradient (soft silver-white/sage/blue-green)
            const val = iter / maxIter
            // Blend from dark teal-green to bright silver-white
            const r = Math.floor(190 * val + 15)
            const g = Math.floor(230 * val + 25)
            const b = Math.floor(210 * val + 20)
            const alpha = Math.floor(220 * val) // Soft fade towards edge
            
            data[idx] = r
            data[idx + 1] = g
            data[idx + 2] = b
            data[idx + 3] = alpha
          }
        }
      }

      ctx.putImageData(imgData, 0, 0)
      time += 0.5
      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animId)
  }, [])

  // ── Shooting Meteors & Star Animation logic ──
  useEffect(() => {
    const timeoutIds: ReturnType<typeof setTimeout>[] = []

    const configs = [
      { id: 'orb-m1', keyframe: 'orbShoot1', duration: '5.2s', initialDelay: 600,  minDwell: 5000,  maxDwell: 15000 },
      { id: 'orb-m2', keyframe: 'orbShoot2', duration: '3.8s', initialDelay: 2500, minDwell: 8000,  maxDwell: 20000 },
      { id: 'orb-m3', keyframe: 'orbShoot3', duration: '6.5s', initialDelay: 5000, minDwell: 6000,  maxDwell: 18000 },
    ]

    function fire(el: HTMLElement, keyframe: string, duration: string, minDwell: number, maxDwell: number) {
      el.style.animation = 'none'
      void el.offsetWidth
      el.style.animation = `${keyframe} ${duration} ease-in forwards`
      
      const onEnd = () => {
        el.removeEventListener('animationend', onEnd)
        el.style.animation = 'none'
        const dwell = minDwell + Math.random() * (maxDwell - minDwell)
        const id = setTimeout(() => fire(el, keyframe, duration, minDwell, maxDwell), dwell)
        timeoutIds.push(id)
      }
      el.addEventListener('animationend', onEnd)
    }

    configs.forEach(({ id, keyframe, duration, initialDelay, minDwell, maxDwell }) => {
      const el = document.getElementById(id)
      if (!el) return
      const tid = setTimeout(() => fire(el, keyframe, duration, minDwell, maxDwell), initialDelay)
      timeoutIds.push(tid)
    })

    return () => { timeoutIds.forEach(clearTimeout) }
  }, [])

  return (
    <>
      <style>{`
        .orb-offline-container {
          position: fixed;
          inset: 0;
          z-index: 99999;
          background: radial-gradient(circle at center, #0e170e 0%, #050805 100%);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          text-align: center;
        }

        /* ── Meteors & Twinkling Starfield ── */
        .orb-meteor {
          position: fixed;
          height: 1px;
          border-radius: 1px;
          background: linear-gradient(to right, #ffffff 0%, rgba(220, 240, 220, 0.8) 30%, transparent 100%);
          pointer-events: none;
          z-index: 3;
          opacity: 0;
        }
        #orb-m1 { top: 5vh;  right: 0; width: 150px; }
        #orb-m2 { top: 25vh; right: 0; width: 90px; }
        #orb-m3 { top: 12vh; right: 0; width: 180px; }

        @keyframes orbShoot1 {
          0% { transform: rotate(-35deg) translateX(0); opacity: 0; }
          4% { opacity: 0.8; }
          80% { opacity: 0.4; }
          100% { transform: rotate(-35deg) translateX(-280vw); opacity: 0; }
        }
        @keyframes orbShoot2 {
          0% { transform: rotate(-40deg) translateX(0); opacity: 0; }
          5% { opacity: 0.9; }
          75% { opacity: 0.3; }
          100% { transform: rotate(-40deg) translateX(-240vw); opacity: 0; }
        }
        @keyframes orbShoot3 {
          0% { transform: rotate(-32deg) translateX(0); opacity: 0; }
          3% { opacity: 0.85; }
          85% { opacity: 0.5; }
          100% { transform: rotate(-32deg) translateX(-320vw); opacity: 0; }
        }

        .orb-star {
          position: fixed;
          border-radius: 50%;
          background: #a2bca2;
          pointer-events: none;
          z-index: 2;
        }
        @keyframes orbTwinkleA { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.9; } }
        @keyframes orbTwinkleB { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes orbTwinkleC { 0%, 100% { opacity: 0.1; } 50% { opacity: 0.75; } }

        .orb-sa { animation: orbTwinkleA 3.2s ease-in-out infinite; }
        .orb-sb { animation: orbTwinkleB 4.1s ease-in-out infinite 0.7s; }
        .orb-sc { animation: orbTwinkleC 2.8s ease-in-out infinite 1.4s; }
        .orb-sd { animation: orbTwinkleA 3.7s ease-in-out infinite 2.1s; }
        .orb-se { animation: orbTwinkleB 5.0s ease-in-out infinite 0.3s; }
        .orb-sf { animation: orbTwinkleC 3.5s ease-in-out infinite 1.8s; }
        .orb-sg { animation: orbTwinkleA 4.3s ease-in-out infinite 0.9s; }
        .orb-sh { animation: orbTwinkleB 2.5s ease-in-out infinite 1.1s; }
        .orb-si { animation: orbTwinkleC 4.8s ease-in-out infinite 0.5s; }
        .orb-sj { animation: orbTwinkleA 3.1s ease-in-out infinite 2.5s; }

        /* ── Ethereal Moonlight Pulsing Orb & Fractal ── */
        .orb-center-visual {
          position: relative;
          width: 320px;
          height: 320px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
        }

        .orb-fractal-canvas {
          position: absolute;
          width: 260px;
          height: 260px;
          border-radius: 50%;
          filter: blur(10px);
          opacity: 0.7;
          mix-blend-mode: screen;
          transform: rotate(0deg);
          animation: orbFractalRotate 80s linear infinite;
          pointer-events: none;
        }
        @keyframes orbFractalRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .orb-moonlight-sphere {
          position: absolute;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          /* Ethereal Moonlight gradient: glowing pearly silver-white-sage */
          background: radial-gradient(circle at 35% 35%, #ffffff 0%, #edf4ed 45%, #b4ccb4 90%);
          /* Ethereal glowing drop shadows & inner bevel */
          box-shadow: 
            0 0 35px rgba(230, 245, 230, 0.45), 
            0 0 70px rgba(230, 245, 230, 0.25), 
            inset -4px -4px 10px rgba(140, 160, 140, 0.35),
            inset 3px 3px 8px rgba(255, 255, 255, 0.85);
          /* Calm tempo breathing pulse animation */
          animation: orbCalmPulse 4.2s ease-in-out infinite;
          z-index: 2;
        }
        @keyframes orbCalmPulse {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 25px rgba(230, 245, 230, 0.4));
          }
          50% {
            transform: scale(1.06);
            filter: drop-shadow(0 0 45px rgba(230, 245, 230, 0.75));
          }
        }

        /* ── Content Layout ── */
        .orb-content-layer {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          max-width: 440px;
        }

        .orb-wordmark {
          position: absolute;
          top: 50%;
          left: 50%;
          z-index: 3;
          font-family: var(--font-ui), sans-serif;
          font-weight: 600;
          font-size: 12px;
          letter-spacing: 0.3em;
          margin-right: -0.3em; /* offset the trailing letter-spacing to center properly */
          text-transform: uppercase;
          color: #142414; /* dark shade for high contrast inside the glowing sphere */
          opacity: 0;
          animation: orbFadeUpCentered 0.8s ease forwards 0.2s;
          pointer-events: none;
        }

        .orb-headline {
          font-family: var(--font-display), serif;
          font-size: 42px;
          font-weight: 300;
          color: #e8ede8;
          line-height: 1.2;
          letter-spacing: -0.015em;
          margin-bottom: 20px;
          opacity: 0;
          animation: orbFadeUp 0.9s ease forwards 0.5s;
        }

        .orb-body-text {
          font-family: var(--font-ui), sans-serif;
          font-size: 15px;
          font-weight: 300;
          color: #a3b5a3;
          line-height: 1.7;
          margin-bottom: 24px;
          opacity: 0;
          animation: orbFadeUp 0.9s ease forwards 0.8s;
        }

        .orb-divider {
          width: 32px;
          height: 1px;
          background: rgba(162, 188, 162, 0.25);
          margin: 16px auto;
          opacity: 0;
          animation: orbFadeIn 1s ease forwards 1.0s;
        }

        .orb-caveat {
          font-family: var(--font-ui), sans-serif;
          font-size: 13px;
          font-weight: 300;
          font-style: italic;
          color: #7b8e7b;
          line-height: 1.6;
          opacity: 0;
          animation: orbFadeUp 0.9s ease forwards 1.1s;
        }

        .orb-status {
          margin-top: 40px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-ui), sans-serif;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #a2bca2;
          border: 1px solid rgba(162, 188, 162, 0.25);
          border-radius: 20px;
          padding: 6px 14px;
          opacity: 0;
          animation: orbFadeUp 0.9s ease forwards 1.3s;
        }

        .orb-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #a2bca2;
          box-shadow: 0 0 8px #a2bca2;
          animation: orbDotPulse 2s ease-in-out infinite;
        }
        @keyframes orbDotPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }

        .orb-version-footer {
          position: fixed;
          bottom: 18px;
          left: 18px;
          font-family: var(--font-ui), sans-serif;
          font-size: 11px;
          color: rgba(232, 237, 232, 0.35);
          letter-spacing: 0.05em;
          z-index: 10;
          white-space: nowrap;
        }

        @keyframes orbFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes orbFadeUpCentered {
          from { opacity: 0; transform: translate(-50%, calc(-50% + 10px)); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
        @keyframes orbFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      <div className="orb-offline-container">
        {/* Meteors */}
        <div id="orb-m1" className="orb-meteor" />
        <div id="orb-m2" className="orb-meteor" />
        <div id="orb-m3" className="orb-meteor" />

        {/* Twinkling Starfield */}
        <span className="orb-star orb-sa" style={{ top: '4vh',  left: '8vw',   width: '5px', height: '5px' }} />
        <span className="orb-star orb-sb" style={{ top: '3vh',  left: '20vw',  width: '3px', height: '3px' }} />
        <span className="orb-star orb-sc" style={{ top: '8vh',  left: '35vw',  width: '4px', height: '4px' }} />
        <span className="orb-star orb-sd" style={{ top: '4vh',  left: '55vw',  width: '3px', height: '3px' }} />
        <span className="orb-star orb-se" style={{ top: '7vh',  left: '70vw',  width: '5px', height: '5px' }} />
        <span className="orb-star orb-sf" style={{ top: '2vh',  left: '85vw',  width: '3px', height: '3px' }} />
        <span className="orb-star orb-sg" style={{ top: '10vh', left: '94vw',  width: '4px', height: '4px' }} />
        <span className="orb-star orb-sh" style={{ top: '22vh', left: '4vw',   width: '3px', height: '3px' }} />
        <span className="orb-star orb-si" style={{ top: '38vh', left: '3vw',   width: '2px', height: '2px' }} />
        <span className="orb-star orb-sj" style={{ top: '56vh', left: '5vw',   width: '4px', height: '4px' }} />
        <span className="orb-star orb-sa" style={{ top: '73vh', left: '4vw',   width: '3px', height: '3px' }} />
        <span className="orb-star orb-sb" style={{ top: '88vh', left: '7vw',   width: '4px', height: '4px' }} />
        <span className="orb-star orb-sc" style={{ top: '20vh', left: '95vw',  width: '4px', height: '4px' }} />
        <span className="orb-star orb-sd" style={{ top: '39vh', left: '96vw',  width: '3px', height: '3px' }} />
        <span className="orb-star orb-se" style={{ top: '59vh', left: '94vw',  width: '4px', height: '4px' }} />
        <span className="orb-star orb-sf" style={{ top: '78vh', left: '93vw',  width: '5px', height: '5px' }} />
        <span className="orb-star orb-sg" style={{ top: '90vh', left: '15vw',  width: '3px', height: '3px' }} />
        <span className="orb-star orb-sh" style={{ top: '94vh', left: '39vw',  width: '4px', height: '4px' }} />
        <span className="orb-star orb-si" style={{ top: '92vh', left: '63vw',  width: '3px', height: '3px' }} />
        <span className="orb-star orb-sj" style={{ top: '89vh', left: '85vw',  width: '4px', height: '4px' }} />
        <span className="orb-star orb-sc" style={{ top: '19vh', left: '43vw',  width: '3px', height: '3px' }} />
        <span className="orb-star orb-se" style={{ top: '29vh', left: '25vw',  width: '2px', height: '2px' }} />
        <span className="orb-star orb-sg" style={{ top: '33vh', left: '73vw',  width: '3px', height: '3px' }} />
        <span className="orb-star orb-si" style={{ top: '63vh', left: '29vw',  width: '2px', height: '2px' }} />
        <span className="orb-star orb-sb" style={{ top: '69vh', left: '59vw',  width: '3px', height: '3px' }} />
        <span className="orb-star orb-sd" style={{ top: '79vh', left: '45vw',  width: '2px', height: '2px' }} />

        {/* Central Visual: Morphing Fractal Background & Ethereal Moonlight Orb */}
        <div className="orb-center-visual">
          <canvas
            ref={canvasRef}
            width={120}
            height={120}
            className="orb-fractal-canvas"
            aria-hidden="true"
          />
          <div className="orb-moonlight-sphere" />
          <div className="orb-wordmark">ORB</div>
        </div>

        {/* Content Panel */}
        <main className="orb-content-layer">
          
          <h1 className="orb-headline">Taking a breather</h1>
          
          <p className="orb-body-text">
            Orb needs an active connection to synchronize your backlog and converse. 
            We’ll be right back as soon as you’re connected again.
          </p>
          
          <div className="orb-divider" />
          
          <p className="orb-caveat">
            If you were mid-conversation or editing a task, those changes are safe in memory and will sync when reconnected.
          </p>
          
          <div className="orb-status">
            <div className="orb-dot" />
            Offline
          </div>
        </main>

        <div className="orb-version-footer">v{VERSION}</div>
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   SAVE FOR LATER: Orbit Theme (Concentric planetary orbits) Background Code
   To restore this theme, replace the `orb-center-visual` container or the
   background SVGs with the following concentric planetary orbit graphic:

   <div className="orb-space-bg" aria-hidden="true">
     <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
       {/* Outer dotted ring - CW * /}
       <g className="orb-spin-cw">
         <circle cx="250" cy="250" r="180" stroke="#547054" strokeWidth="1.5" strokeDasharray="3 8" />
       </g>
       {/* Middle solid ring - CCW with a planet * /}
       <g className="orb-spin-ccw">
         <circle cx="250" cy="250" r="120" stroke="#8caf8c" strokeWidth="1" opacity="0.6" />
         <circle cx="250" cy="130" r="6" fill="#b8d0b8" />
       </g>
       {/* Inner dashed ring - CW with a planet * /}
       <g className="orb-spin-fast-cw">
         <circle cx="250" cy="250" r="70" stroke="#e8ede8" strokeWidth="1.5" strokeDasharray="6 6" opacity="0.8" />
         <circle cx="180" cy="250" r="4" fill="#e8ede8" />
       </g>
       {/* Pulsing center Orb * /}
       <defs>
         <radialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
           <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
           <stop offset="40%" stopColor="#d4e4d4" stopOpacity="0.8" />
           <stop offset="80%" stopColor="#b8d0b8" stopOpacity="0.3" />
           <stop offset="100%" stopColor="#b8d0b8" stopOpacity="0" />
         </radialGradient>
       </defs>
       <circle cx="250" cy="250" r="32" fill="url(#orbGlow)" />
     </svg>
   </div>
   ───────────────────────────────────────────────────────────────────────────── */

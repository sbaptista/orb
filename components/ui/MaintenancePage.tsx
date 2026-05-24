'use client'

import { useEffect, useRef } from 'react'
import OrbVersionLabel from '@/components/ui/OrbVersionLabel'

interface MaintenancePageProps {
  isOverlay?: boolean
}

export default function MaintenancePage({ isOverlay = false }: MaintenancePageProps) {
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
            // Exterior: ethereal moonlight gradient
            const val = iter / maxIter
            const r = Math.floor(190 * val + 15)
            const g = Math.floor(230 * val + 25)
            const b = Math.floor(210 * val + 20)
            const alpha = Math.floor(220 * val)
            
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
      { id: 'maint-m1', keyframe: 'maintShoot1', duration: '5.2s', initialDelay: 600,  minDwell: 5000,  maxDwell: 15000 },
      { id: 'maint-m2', keyframe: 'maintShoot2', duration: '3.8s', initialDelay: 2500, minDwell: 8000,  maxDwell: 20000 },
      { id: 'maint-m3', keyframe: 'maintShoot3', duration: '6.5s', initialDelay: 5000, minDwell: 6000,  maxDwell: 18000 },
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
        .orb-maint-container {
          position: fixed;
          inset: 0;
          z-index: ${isOverlay ? '99999' : '99998'};
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
        .orb-maint-meteor {
          position: fixed;
          height: 1px;
          border-radius: 1px;
          background: linear-gradient(to right, #ffffff 0%, rgba(220, 240, 220, 0.8) 30%, transparent 100%);
          pointer-events: none;
          z-index: 3;
          opacity: 0;
        }
        #maint-m1 { top: 5vh;  right: 0; width: 150px; }
        #maint-m2 { top: 25vh; right: 0; width: 90px; }
        #maint-m3 { top: 12vh; right: 0; width: 180px; }

        @keyframes maintShoot1 {
          0% { transform: rotate(-35deg) translateX(0); opacity: 0; }
          4% { opacity: 0.8; }
          80% { opacity: 0.4; }
          100% { transform: rotate(-35deg) translateX(-280vw); opacity: 0; }
        }
        @keyframes maintShoot2 {
          0% { transform: rotate(-40deg) translateX(0); opacity: 0; }
          5% { opacity: 0.9; }
          75% { opacity: 0.3; }
          100% { transform: rotate(-40deg) translateX(-240vw); opacity: 0; }
        }
        @keyframes maintShoot3 {
          0% { transform: rotate(-32deg) translateX(0); opacity: 0; }
          3% { opacity: 0.85; }
          85% { opacity: 0.5; }
          100% { transform: rotate(-32deg) translateX(-320vw); opacity: 0; }
        }

        .orb-maint-star {
          position: fixed;
          border-radius: 50%;
          background: #a2bca2;
          pointer-events: none;
          z-index: 2;
        }
        @keyframes maintTwinkleA { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.9; } }
        @keyframes maintTwinkleB { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes maintTwinkleC { 0%, 100% { opacity: 0.1; } 50% { opacity: 0.75; } }

        .orb-maint-sa { animation: maintTwinkleA 3.2s ease-in-out infinite; }
        .orb-maint-sb { animation: maintTwinkleB 4.1s ease-in-out infinite 0.7s; }
        .orb-maint-sc { animation: maintTwinkleC 2.8s ease-in-out infinite 1.4s; }
        .orb-maint-sd { animation: maintTwinkleA 3.7s ease-in-out infinite 2.1s; }
        .orb-maint-se { animation: maintTwinkleB 5.0s ease-in-out infinite 0.3s; }
        .orb-maint-sf { animation: maintTwinkleC 3.5s ease-in-out infinite 1.8s; }
        .orb-maint-sg { animation: maintTwinkleA 4.3s ease-in-out infinite 0.9s; }
        .orb-maint-sh { animation: maintTwinkleB 2.5s ease-in-out infinite 1.1s; }
        .orb-maint-si { animation: maintTwinkleC 4.8s ease-in-out infinite 0.5s; }
        .orb-maint-sj { animation: maintTwinkleA 3.1s ease-in-out infinite 2.5s; }

        /* ── Ethereal Moonlight Pulsing Orb & Fractal ── */
        .orb-maint-center-visual {
          position: relative;
          width: 320px;
          height: 320px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
        }

        .orb-maint-fractal-canvas {
          position: absolute;
          width: 260px;
          height: 260px;
          border-radius: 50%;
          filter: blur(10px);
          opacity: 0.7;
          mix-blend-mode: screen;
          transform: rotate(0deg);
          animation: maintFractalRotate 80s linear infinite;
          pointer-events: none;
        }
        @keyframes maintFractalRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .orb-maint-moonlight-sphere {
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
          animation: maintCalmPulse 4.2s ease-in-out infinite;
          z-index: 2;
        }
        @keyframes maintCalmPulse {
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
        .orb-maint-content-layer {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          max-width: 440px;
        }

        .orb-maint-wordmark {
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
          animation: maintFadeUpCentered 0.8s ease forwards 0.2s;
          pointer-events: none;
        }

        .orb-maint-headline {
          font-family: var(--font-display), serif;
          font-size: 42px;
          font-weight: 300;
          color: #e8ede8;
          line-height: 1.2;
          letter-spacing: -0.015em;
          margin-bottom: 20px;
          opacity: 0;
          animation: maintFadeUp 0.9s ease forwards 0.5s;
        }

        .orb-maint-body-text {
          font-family: var(--font-ui), sans-serif;
          font-size: 15px;
          font-weight: 300;
          color: #a3b5a3;
          line-height: 1.7;
          margin-bottom: 24px;
          opacity: 0;
          animation: maintFadeUp 0.9s ease forwards 0.8s;
        }

        .orb-maint-divider {
          width: 32px;
          height: 1px;
          background: rgba(162, 188, 162, 0.25);
          margin: 16px auto;
          opacity: 0;
          animation: maintFadeIn 1s ease forwards 1.0s;
        }

        .orb-maint-caveat {
          font-family: var(--font-ui), sans-serif;
          font-size: 13px;
          font-weight: 300;
          font-style: italic;
          color: #7b8e7b;
          line-height: 1.6;
          opacity: 0;
          animation: maintFadeUp 0.9s ease forwards 1.1s;
        }

        .orb-maint-status {
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
          animation: maintFadeUp 0.9s ease forwards 1.3s;
        }

        .orb-maint-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #a2bca2;
          box-shadow: 0 0 8px #a2bca2;
          animation: maintDotPulse 2s ease-in-out infinite;
        }
        @keyframes maintDotPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }

        .orb-maint-version-footer {
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

        @keyframes maintFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes maintFadeUpCentered {
          from { opacity: 0; transform: translate(-50%, calc(-50% + 10px)); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
        @keyframes maintFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      <div className="orb-maint-container">
        {/* Meteors */}
        <div id="maint-m1" className="orb-maint-meteor" />
        <div id="maint-m2" className="orb-maint-meteor" />
        <div id="maint-m3" className="orb-maint-meteor" />

        {/* Twinkling Starfield */}
        <span className="orb-maint-star orb-maint-sa" style={{ top: '4vh',  left: '8vw',   width: '5px', height: '5px' }} />
        <span className="orb-maint-star orb-maint-sb" style={{ top: '3vh',  left: '20vw',  width: '3px', height: '3px' }} />
        <span className="orb-maint-star orb-maint-sc" style={{ top: '8vh',  left: '35vw',  width: '4px', height: '4px' }} />
        <span className="orb-maint-star orb-maint-sd" style={{ top: '4vh',  left: '55vw',  width: '3px', height: '3px' }} />
        <span className="orb-maint-star orb-maint-se" style={{ top: '7vh',  left: '70vw',  width: '5px', height: '5px' }} />
        <span className="orb-maint-star orb-maint-sf" style={{ top: '2vh',  left: '85vw',  width: '3px', height: '3px' }} />
        <span className="orb-maint-star orb-maint-sg" style={{ top: '10vh', left: '94vw',  width: '4px', height: '4px' }} />
        <span className="orb-maint-star orb-maint-sh" style={{ top: '22vh', left: '4vw',   width: '3px', height: '3px' }} />
        <span className="orb-maint-star orb-maint-si" style={{ top: '38vh', left: '3vw',   width: '2px', height: '2px' }} />
        <span className="orb-maint-star orb-maint-sj" style={{ top: '56vh', left: '5vw',   width: '4px', height: '4px' }} />
        <span className="orb-maint-star orb-maint-sa" style={{ top: '73vh', left: '4vw',   width: '3px', height: '3px' }} />
        <span className="orb-maint-star orb-maint-sb" style={{ top: '88vh', left: '7vw',   width: '4px', height: '4px' }} />
        <span className="orb-maint-star orb-maint-sc" style={{ top: '20vh', left: '95vw',  width: '4px', height: '4px' }} />
        <span className="orb-maint-star orb-maint-sd" style={{ top: '39vh', left: '96vw',  width: '3px', height: '3px' }} />
        <span className="orb-maint-star orb-maint-se" style={{ top: '59vh', left: '94vw',  width: '4px', height: '4px' }} />
        <span className="orb-maint-star orb-maint-sf" style={{ top: '78vh', left: '93vw',  width: '5px', height: '5px' }} />
        <span className="orb-maint-star orb-maint-sg" style={{ top: '90vh', left: '15vw',  width: '3px', height: '3px' }} />
        <span className="orb-maint-star orb-maint-sh" style={{ top: '94vh', left: '39vw',  width: '4px', height: '4px' }} />
        <span className="orb-maint-star orb-maint-si" style={{ top: '92vh', left: '63vw',  width: '3px', height: '3px' }} />
        <span className="orb-maint-star orb-maint-sj" style={{ top: '89vh', left: '85vw',  width: '4px', height: '4px' }} />
        <span className="orb-maint-star orb-maint-sc" style={{ top: '19vh', left: '43vw',  width: '3px', height: '3px' }} />
        <span className="orb-maint-star orb-maint-se" style={{ top: '29vh', left: '25vw',  width: '2px', height: '2px' }} />
        <span className="orb-maint-star orb-maint-sg" style={{ top: '33vh', left: '73vw',  width: '3px', height: '3px' }} />
        <span className="orb-maint-star orb-maint-si" style={{ top: '63vh', left: '29vw',  width: '2px', height: '2px' }} />
        <span className="orb-maint-star orb-maint-sb" style={{ top: '69vh', left: '59vw',  width: '3px', height: '3px' }} />
        <span className="orb-maint-star orb-maint-sd" style={{ top: '79vh', left: '45vw',  width: '2px', height: '2px' }} />

        {/* Central Visual: Morphing Fractal Background & Ethereal Moonlight Orb */}
        <div className="orb-maint-center-visual">
          <canvas
            ref={canvasRef}
            width={120}
            height={120}
            className="orb-maint-fractal-canvas"
            aria-hidden="true"
          />
          <div className="orb-maint-moonlight-sphere" />
          <div className="orb-maint-wordmark">ORB</div>
        </div>

        {/* Content Panel */}
        <main className="orb-maint-content-layer">
          <h1 className="orb-maint-headline">Undergoing Maintenance</h1>
          
          <p className="orb-maint-body-text">
            Orb is undergoing scheduled maintenance to improve system stability and deploy upgrades. 
            We will be back online shortly.
          </p>
          
          <div className="orb-maint-divider" />
          
          <p className="orb-maint-caveat">
            Your active session is preserved. Normal operations will resume automatically once maintenance is complete.
          </p>
          
          <div className="orb-maint-status">
            <div className="orb-maint-dot" />
            Maintenance
          </div>
        </main>

        <OrbVersionLabel as="div" className="orb-maint-version-footer" format="version" />
      </div>
    </>
  )
}

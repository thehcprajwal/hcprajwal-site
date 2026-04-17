/**
 * three-bg.js — Three.js particle background + matrix rain
 * setIdle()      — called by terminal to trigger/clear matrix rain
 * triggerPulse() — called by terminal + contact on boot/submit
 */
import * as THREE from 'three';

let _idle = false;

export function setIdle(val) { _idle = val; }

export function triggerPulse() {
    const app = document.getElementById('app');
    if (!app) return;
    app.classList.remove('pulse');
    void app.offsetWidth;
    app.classList.add('pulse');
    setTimeout(() => app.classList.remove('pulse'), 800);
}

export function initThreeBackground() {
    const canvas   = document.getElementById('bg-canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
    camera.position.z = 30;

    // ── Floating particles ────────────────────────────────────────
    const N   = 400;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const c   = new THREE.Color();

    for (let i = 0; i < N * 3; i += 3) {
        pos[i]   = (Math.random() - 0.5) * 95;
        pos[i+1] = (Math.random() - 0.5) * 95;
        pos[i+2] = (Math.random() - 0.5) * 60;
        c.setHSL(0.38 + Math.random() * 0.08, 0.9, 0.55 + Math.random() * 0.2);
        col[i] = c.r; col[i+1] = c.g; col[i+2] = c.b;
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pGeo.setAttribute('color',    new THREE.BufferAttribute(col, 3));

    const pMat = new THREE.PointsMaterial({
        size: 0.2, vertexColors: true,
        transparent: true, opacity: 0.3,
        depthTest: false, blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // ── Matrix rain ───────────────────────────────────────────────
    const R    = 220;
    const rPos = new Float32Array(R * 3);
    const rVel = new Float32Array(R);

    for (let i = 0; i < R; i++) {
        rPos[i*3]   = (Math.random() - 0.5) * 120;
        rPos[i*3+1] = Math.random() * 100 - 50;
        rPos[i*3+2] = (Math.random() - 0.5) * 50;
        rVel[i]     = 0.04 + Math.random() * 0.12;
    }

    const rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));

    const rMat = new THREE.PointsMaterial({
        size: 0.55, color: 0x39ff14,
        transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending
    });

    const rain = new THREE.Points(rGeo, rMat);
    scene.add(rain);

    // ── Mouse parallax ────────────────────────────────────────────
    let mx = 0, my = 0;
    document.addEventListener('mousemove', e => {
        mx = e.clientX / innerWidth  - 0.5;
        my = e.clientY / innerHeight - 0.5;
    });

    // ── Render loop ───────────────────────────────────────────────
    (function animate() {
        requestAnimationFrame(animate);

        particles.rotation.y += 0.00055;
        particles.rotation.x += 0.00025;

        camera.position.x += (mx * 3  - camera.position.x) * 0.018;
        camera.position.y += (-my * 2 - camera.position.y) * 0.018;
        camera.lookAt(0, 0, 0);

        if (_idle) {
            rMat.opacity = Math.min(0.65, rMat.opacity + 0.015);
            const a = rGeo.attributes.position.array;
            for (let i = 0; i < R; i++) {
                a[i*3+1] -= rVel[i];
                if (a[i*3+1] < -55) {
                    a[i*3+1] = 55;
                    a[i*3]   = (Math.random() - 0.5) * 120;
                }
            }
            rGeo.attributes.position.needsUpdate = true;
        } else {
            rMat.opacity = Math.max(0, rMat.opacity - 0.03);
        }

        renderer.render(scene, camera);
    })();

    window.addEventListener('resize', () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
    });
}

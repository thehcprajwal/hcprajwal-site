/**
 * bg.js — Three.js background: floating particles + matrix rain on idle
 * Exposed as window.HCBg
 */
window.HCBg = (() => {
    let scene, camera, renderer, particles, matrixRain;
    let isIdle = false;

    function buildParticles() {
        const count = 380;
        const positions = new Float32Array(count * 3);
        const colors    = new Float32Array(count * 3);
        const color     = new THREE.Color();

        for (let i = 0; i < count * 3; i += 3) {
            positions[i]     = (Math.random() - 0.5) * 90;
            positions[i + 1] = (Math.random() - 0.5) * 90;
            positions[i + 2] = (Math.random() - 0.5) * 60;

            color.setHSL(0.42, 0.9, 0.65);
            colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.22,
            vertexColors: true,
            transparent: true,
            opacity: 0.35,
            depthTest: false,
            blending: THREE.AdditiveBlending
        });

        return new THREE.Points(geo, mat);
    }

    function buildMatrixRain() {
        const count = 180;
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count * 3; i += 3) {
            positions[i]     = (Math.random() - 0.5) * 100;
            positions[i + 1] = Math.random() * 80 - 40;
            positions[i + 2] = (Math.random() - 0.5) * 30;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.6,
            color: 0x00ff88,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending
        });

        return new THREE.Points(geo, mat);
    }

    function animate() {
        requestAnimationFrame(animate);

        particles.rotation.y += 0.0006;
        particles.rotation.x += 0.0003;

        if (isIdle) {
            matrixRain.material.opacity = Math.min(0.6, matrixRain.material.opacity + 0.02);
            matrixRain.rotation.y += 0.002;
        } else {
            matrixRain.material.opacity = Math.max(0, matrixRain.material.opacity - 0.03);
        }

        renderer.render(scene, camera);
    }

    function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function init() {
        const canvas = document.getElementById('bg-canvas');

        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);

        scene  = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 30;

        particles  = buildParticles();
        matrixRain = buildMatrixRain();
        scene.add(particles, matrixRain);

        animate();
        window.addEventListener('resize', onResize);
    }

    function setIdle(state) {
        isIdle = state;
    }

    return { init, setIdle };
})();

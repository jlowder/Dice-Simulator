class DiceRoller {
    constructor() {
        this.dice = [];
        this.pins = [];
        this.bins = [];
        this.walls = [];
        this.isRolling = false;
        this.sides = 6;

        // Configuration Constants
        this.PIN_SPACING = 6.0;
        this.PIN_RADIUS = 0.3;
        this.PIN_DEPTH = 4;
        this.WALL_X = 28;
        this.WALL_HEIGHT = 50;
        this.WALL_DEPTH = 10;
        this.BIN_Y = -12;
        this.DICE_SIZE = 1.5;
        this.SPAWN_Y = 40;

        // Camera constants
        this.CAMERA_DEFAULT_POS = new THREE.Vector3(0, 12, 40);
        this.CAMERA_DEFAULT_LOOKAT = new THREE.Vector3(0, 12, 0);
        this.CAMERA_LERP_FACTOR = 0.05;

        this.cameraTargetPos = this.CAMERA_DEFAULT_POS.clone();
        this.cameraTargetLookAt = this.CAMERA_DEFAULT_LOOKAT.clone();
        this.cameraCurrentLookAt = this.CAMERA_DEFAULT_LOOKAT.clone();

        this.pinMaterial = null;
        this.binMaterial = null;
        this.wallMaterial = null;
    }

    init() {
        this.initThreeJS();
        this.initCannonJS();
        this.setupUI();
        this.createPlinkoPins();
        this.createDice();
        this.animate();
    }

    initThreeJS() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.copy(this.CAMERA_DEFAULT_POS);
        this.camera.lookAt(this.CAMERA_DEFAULT_LOOKAT);
        
        const canvas = document.getElementById('canvas');
        if (!canvas) {
            console.error('Canvas element not found');
            return;
        }
        
        this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        
        this.setupLighting();
        this.setupFloor();
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 5);
        this.scene.add(directionalLight);
    }

    setupFloor() {
        const planeGeometry = new THREE.PlaneGeometry(100, 100);
        const planeMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x050505,
            roughness: 0.9
        });
        
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -10;
        plane.receiveShadow = true;
        this.scene.add(plane);
    }

    createPlinkoPins() {
        const pinCountRows = 8;
        const pinCountCols = 9;
        const startY = 32;
        const centerX = 0;
        
        for (let row = 0; row < pinCountRows; row++) {
            const pinsInRow = pinCountCols - (row % 2);
            const rowWidth = (pinsInRow - 1) * this.PIN_SPACING;
            const startX = centerX - rowWidth / 2;
            const y = startY - row * this.PIN_SPACING * 0.866;
            
            for (let col = 0; col < pinsInRow; col++) {
                const x = startX + col * this.PIN_SPACING;
                this.createPin(x, y, this.PIN_RADIUS);
            }
        }
        
        this.createTransparentWalls();
        this.createBinCollectors();
    }

    createPin(x, y, radius) {
        const pinGeometry = new THREE.CylinderGeometry(radius, radius, this.PIN_DEPTH, 32);
        const pinMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.6,
            roughness: 0.4
        });
        
        const pinMesh = new THREE.Mesh(pinGeometry, pinMaterial);
        pinMesh.position.set(x, y, 0);
        pinMesh.rotation.x = Math.PI / 2;
        pinMesh.castShadow = true;
        this.scene.add(pinMesh);
        
        const pinShape = new CANNON.Cylinder(radius, radius, this.PIN_DEPTH, 32);
        const pinBody = new CANNON.Body({
            mass: 0,
            shape: pinShape,
            material: this.pinMaterial
        });
        pinBody.position.set(x, y, 0);
        const quat = new CANNON.Quaternion();
        quat.setFromEuler(Math.PI / 2, 0, 0);
        pinBody.quaternion.copy(quat);
        
        this.world.addBody(pinBody);
        this.pins.push({ mesh: pinMesh, body: pinBody });
    }

    createTransparentWalls() {
        const wallThickness = 2;

        // Side walls
        this.createWall(-this.WALL_X, wallThickness, this.WALL_HEIGHT, 0, this.WALL_DEPTH);
        this.createWall(this.WALL_X, wallThickness, this.WALL_HEIGHT, 0, this.WALL_DEPTH);

        // Front and back walls
        this.createWall(0, this.WALL_X * 2, this.WALL_HEIGHT, this.WALL_DEPTH/2, 0.5, 0.05);
        this.createWall(0, this.WALL_X * 2, this.WALL_HEIGHT, -this.WALL_DEPTH/2, 0.5, 0.05);
    }

    createWall(x, width, height, z, depth, opacity = 0.3) {
        const wallGeometry = new THREE.BoxGeometry(width, height, depth);
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.1,
            roughness: 0.8,
            transparent: true,
            opacity: opacity
        });
        
        const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
        wallMesh.position.set(x, height/2 - 5, z);
        this.scene.add(wallMesh);
        
        const wallShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
        const wallBody = new CANNON.Body({
            mass: 0,
            shape: wallShape,
            material: this.wallMaterial
        });
        wallBody.position.set(x, height/2 - 5, z);
        this.world.addBody(wallBody);
        
        this.walls.push({ mesh: wallMesh, body: wallBody });
    }

    createBinCollectors() {
        const numBins = 11;
        const binWidth = 5.0;
        const binXStart = -numBins * binWidth / 2;
        
        this.binMultipliers = [10, 5, 2, 1, 0.5, 0.2, 0.5, 1, 2, 5, 10];
        
        for (let i = 0; i < numBins; i++) {
            const x = binXStart + (i + 0.5) * binWidth;
            this.createBin(x, this.BIN_Y, binWidth, 4, i);
        }
    }

    createBin(x, y, width, height, i) {
        const binGeometry = new THREE.BoxGeometry(width, height, 4);
        const binMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a6fa5,
            metalness: 0.3,
            roughness: 0.7
        });
        
        const binMesh = new THREE.Mesh(binGeometry, binMaterial);
        binMesh.position.set(x, y, 0);
        this.scene.add(binMesh);
        
        const binShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, 2));
        const binBody = new CANNON.Body({
            mass: 0,
            shape: binShape,
            material: this.binMaterial
        });
        binBody.position.set(x, y, 0);
        this.world.addBody(binBody);
        
        this.bins.push({ 
            mesh: binMesh, 
            body: binBody, 
            x: x,
            y: y,
            width: width,
            multiplier: this.binMultipliers[i] || 1
        });
    }

    initCannonJS() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0);
        
        this.diceMaterial = new CANNON.Material('dice');
        this.pinMaterial = new CANNON.Material('pin');
        this.binMaterial = new CANNON.Material('bin');
        this.wallMaterial = new CANNON.Material('wall');
        this.floorMaterial = new CANNON.Material('floor');
        
        this.world.addContactMaterial(new CANNON.ContactMaterial(
            this.diceMaterial, this.floorMaterial, { friction: 0.5, restitution: 0.4 }
        ));
        this.world.addContactMaterial(new CANNON.ContactMaterial(
            this.diceMaterial, this.pinMaterial, { friction: 0.1, restitution: 0.7 }
        ));
        this.world.addContactMaterial(new CANNON.ContactMaterial(
            this.diceMaterial, this.wallMaterial, { friction: 0.3, restitution: 0.5 }
        ));
        
        this.floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
        this.floorBody.position.set(0, -10, 0);
        this.floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(this.floorBody);
    }

    createDice() {
        if (this.dice && this.dice.length > 0) {
            this.dice.forEach(die => {
                this.scene.remove(die.mesh);
                this.world.removeBody(die.body);
            });
        }
        this.dice = [this.createSingleDie()];
    }

    createSingleDie() {
        const size = this.DICE_SIZE;
        const textures = [];
        const faceValues = [1, 6, 2, 5, 3, 4];
        
        for (let value of faceValues) {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 128, 128);
            ctx.strokeStyle = '#cccccc';
            ctx.lineWidth = 5;
            ctx.strokeRect(0, 0, 128, 128);
            ctx.fillStyle = '#000000';
            
            const drawDot = (x, y) => {
                ctx.beginPath();
                ctx.arc(x, y, 12, 0, Math.PI * 2);
                ctx.fill();
            };
            
            const cx = 64, cy = 64, offset = 35;
            if (value === 1) drawDot(cx, cy);
            else if (value === 2) { drawDot(cx - offset, cy - offset); drawDot(cx + offset, cy + offset); }
            else if (value === 3) { drawDot(cx - offset, cy - offset); drawDot(cx, cy); drawDot(cx + offset, cy + offset); }
            else if (value === 4) { drawDot(cx - offset, cy - offset); drawDot(cx + offset, cy - offset); drawDot(cx - offset, cy + offset); drawDot(cx + offset, cy + offset); }
            else if (value === 5) { drawDot(cx - offset, cy - offset); drawDot(cx + offset, cy - offset); drawDot(cx, cy); drawDot(cx - offset, cy + offset); drawDot(cx + offset, cy + offset); }
            else if (value === 6) { drawDot(cx - offset, cy - 25); drawDot(cx + offset, cy - 25); drawDot(cx - offset, cy); drawDot(cx + offset, cy); drawDot(cx - offset, cy + 25); drawDot(cx + offset, cy + 25); }
            
            textures.push(new THREE.CanvasTexture(canvas));
        }
        
        const materials = textures.map(tex => new THREE.MeshStandardMaterial({ map: tex }));
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), materials);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        
        const body = new CANNON.Body({
            mass: 1,
            shape: new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2)),
            material: this.diceMaterial,
            angularDamping: 0.1,
            linearDamping: 0.05
        });
        
        body.position.set(0, this.SPAWN_Y, 0);
        body.quaternion.setFromEuler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        this.world.addBody(body);
        
        return { mesh, body, sides: this.sides, resultDeclared: false };
    }

    updatePhysicsObjects() {
        [...this.pins, ...this.bins, ...this.walls, ...this.dice].forEach(obj => {
            obj.mesh.position.copy(obj.body.position);
            obj.mesh.quaternion.copy(obj.body.quaternion);
        });
    }

    setupUI() {
        const sidesInput = document.getElementById('sides');
        if (sidesInput) {
            this.sides = parseInt(sidesInput.value) || 6;
            sidesInput.addEventListener('change', (e) => {
                this.sides = parseInt(e.target.value) || 6;
                this.createDice();
            });
        }
        
        const rollBtn = document.getElementById('rollBtn');
        if (rollBtn) {
            rollBtn.addEventListener('click', () => this.rollDice());
        }

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    rollDice() {
        if (this.isRolling) return;
        this.isRolling = true;
        
        // Reset camera
        this.cameraTargetPos.copy(this.CAMERA_DEFAULT_POS);
        this.cameraTargetLookAt.copy(this.CAMERA_DEFAULT_LOOKAT);

        this.dice.forEach(die => {
            die.body.position.set((Math.random() - 0.5) * 10, this.SPAWN_Y, 0);
            die.body.velocity.set((Math.random() - 0.5) * 2, -10, 0);
            die.body.angularVelocity.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
            die.body.quaternion.setFromEuler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            die.resultDeclared = false;
        });
        
        setTimeout(() => { this.isRolling = false; }, 8000);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.world.step(1/60);
        this.updatePhysicsObjects();
        this.dice.forEach(die => this.checkDiceResult(die));

        // Smooth camera movement
        this.camera.position.lerp(this.cameraTargetPos, this.CAMERA_LERP_FACTOR);
        this.cameraCurrentLookAt.lerp(this.cameraTargetLookAt, this.CAMERA_LERP_FACTOR);
        this.camera.lookAt(this.cameraCurrentLookAt);

        this.renderer.render(this.scene, this.camera);
    }

    checkDiceResult(die) {
        if (die.resultDeclared) return;
        
        // Die is roughly in a bin and stopped
        const isNearBins = Math.abs(die.mesh.position.y - (this.BIN_Y + 1)) < 3;
        const isStopped = die.body.velocity.length() < 0.3;

        if (isStopped && isNearBins) {
            for (let bin of this.bins) {
                if (die.mesh.position.x >= bin.x - bin.width/2 && 
                    die.mesh.position.x <= bin.x + bin.width/2) {
                    console.log(`Result detected: bin ${bin.multiplier}`);
                    this.displayResult(die.sides, bin.multiplier);
                    die.resultDeclared = true;

                    // Zoom in on die
                    this.cameraTargetPos.set(die.mesh.position.x, die.mesh.position.y + 3, 8);
                    this.cameraTargetLookAt.copy(die.mesh.position);
                    break;
                }
            }
        }

        if (!die.resultDeclared && die.mesh.position.y < -15) {
            this.displayResult(die.sides, 0);
            die.resultDeclared = true;
        }
    }

    displayResult(sides, multiplier) {
        const resultEl = document.getElementById('result');
        if (!resultEl) return;
        
        const dieValue = Math.floor(Math.random() * sides) + 1;
        const displayMultiplier = multiplier >= 1 ? multiplier : 'x' + multiplier;
        
        resultEl.textContent = `Rolled ${dieValue} (Multiplier: ${displayMultiplier})`;
        resultEl.classList.add('show');
        
        setTimeout(() => { resultEl.classList.remove('show'); }, 3000);
    }
}

let diceRoller;
document.addEventListener('DOMContentLoaded', () => {
    diceRoller = new DiceRoller();
    diceRoller.init();
});

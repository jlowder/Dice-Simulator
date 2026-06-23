class DiceRoller {
    constructor() {
        this.dice = [];
        this.pins = [];
        this.bins = [];
        this.walls = [];
        this.isRolling = false;
        this.sides = 6;
        this.cameraOrbitTime = 0;
        this.pinMaterial = null;
        this.binMaterial = null;
        this.wallMaterial = null;
    }

    init() {
        this.initThreeJS();
        this.initCannonJS();
        this.setupInput();
        this.setupEventListeners();
        this.createPlinkoPins();
        this.createDice();
        this.animate();
    }

    initThreeJS() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, 0);
        
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
        const planeGeometry = new THREE.PlaneGeometry(50, 50);
        const planeMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2a2a4e,
            roughness: 0.8 
        });
        
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -1;
        plane.receiveShadow = true;
        this.scene.add(plane);
        
        const gridHelper = new THREE.GridHelper(50, 20, 0x4a6fa5, 0x2a2a4e);
        this.scene.add(gridHelper);
    }

    createPlinkoPins() {
        const pinCountRows = 10;
        const pinCountCols = 15;
        const spacing = 3.0;
        const pinRadius = 0.4;
        const startY = 8;
        const centerX = 0;
        const centerZ = 0;
        
        for (let row = 0; row < pinCountRows; row++) {
            const isEvenRow = row % 2 === 0;
            const pinsInRow = pinCountCols - (row % 2);
            const rowWidth = (pinsInRow - 1) * spacing;
            const startX = centerX - rowWidth / 2;
            
            for (let col = 0; col < pinsInRow; col++) {
                const x = startX + col * spacing;
                const z = centerZ - (row * spacing * 0.866);
                
                this.createPin(x, z, pinRadius);
            }
        }
        
        this.createTransparentWalls();
        this.createBinCollectors();
    }

    createPin(x, z, radius) {
        const pinHeight = 2;
        
        const pinGeometry = new THREE.CylinderGeometry(radius, radius, pinHeight, 32);
        const pinMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.6,
            roughness: 0.4
        });
        
        const pinMesh = new THREE.Mesh(pinGeometry, pinMaterial);
        pinMesh.position.set(x, pinHeight/2, z);
        pinMesh.rotation.x = -Math.PI / 2;
        pinMesh.castShadow = true;
        this.scene.add(pinMesh);
        
        const pinShape = new CANNON.Cylinder(radius, radius, pinHeight/2, 32);
        const pinBody = new CANNON.Body({
            mass: 0,
            shape: pinShape,
            material: this.pinMaterial
        });
        pinBody.position.set(x, pinHeight/2, z);
        this.world.addBody(pinBody);
        
        this.pins.push({ mesh: pinMesh, body: pinBody });
    }

    createTransparentWalls() {
        const wallWidth = 2;
        const wallHeight = 25;
        const wallZ = -13;
        const wallX = 23;
        
        this.createWall(-wallX, wallWidth, wallHeight, wallZ);
        this.createWall(wallX, wallWidth, wallHeight, wallZ);
    }

    createWall(x, width, height, z) {
        const wallGeometry = new THREE.BoxGeometry(width, height, 1);
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.1,
            roughness: 0.8,
            transparent: true,
            opacity: 0.3
        });
        
        const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
        wallMesh.position.set(x, height/2 - 1, z);
        this.scene.add(wallMesh);
        
        const wallShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, 0.5));
        const wallBody = new CANNON.Body({
            mass: 0,
            shape: wallShape,
            material: this.wallMaterial
        });
        wallBody.position.set(x, height/2 - 1, z);
        this.world.addBody(wallBody);
        
        this.walls.push({ mesh: wallMesh, body: wallBody });
    }

    createBinCollectors() {
        const numBins = 13;
        const binWidth = 2.2;
        const binXStart = -numBins * binWidth / 2;
        const binZ = -17;
        
        this.binMultipliers = [10, 5, 3, 2, 1, 0.5, 0.2, 0.5, 1, 2, 3, 5, 10];
        
        for (let i = 0; i < numBins; i++) {
            const x = binXStart + (i + 0.5) * binWidth;
            const z = binZ;
            
            this.createBin(x, z, binWidth, binWidth / 4, i);
        }
    }

    createBin(x, z, width, height, i) {
        const binGeometry = new THREE.BoxGeometry(width, height, 1);
        const binMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a6fa5,
            metalness: 0.3,
            roughness: 0.7
        });
        
        const binMesh = new THREE.Mesh(binGeometry, binMaterial);
        binMesh.position.set(x, -0.5, z);
        this.scene.add(binMesh);
        
        const binShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, 0.5));
        const binBody = new CANNON.Body({
            mass: 0,
            shape: binShape,
            material: this.binMaterial
        });
        binBody.position.set(x, -0.5, z);
        this.world.addBody(binBody);
        
        this.bins.push({ 
            mesh: binMesh, 
            body: binBody, 
            x: x,
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
        
        const diceFloorContact = new CANNON.ContactMaterial(
            this.diceMaterial,
            this.floorMaterial,
            { friction: 0.5, restitution: 0.4 }
        );
        this.world.addContactMaterial(diceFloorContact);
        
        const dicePinContact = new CANNON.ContactMaterial(
            this.diceMaterial,
            this.pinMaterial,
            { friction: 0.2, restitution: 0.6 }
        );
        this.world.addContactMaterial(dicePinContact);
        
        const diceWallContact = new CANNON.ContactMaterial(
            this.diceMaterial,
            this.wallMaterial,
            { friction: 0.3, restitution: 0.5 }
        );
        this.world.addContactMaterial(diceWallContact);
        
        this.floorBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Plane()
        });
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
        this.dice = [];
        
        const die = this.createSingleDie();
        this.dice.push(die);
    }

    createSingleDie() {
        const size = 1.5;
        
        // Create individual textures for each dice face (1-6)
        const textures = [];
        const faceValues = [1, 6, 2, 5, 3, 4]; // Right, Left, Top, Bottom, Front, Back
        
        for (let value of faceValues) {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            
            // White background with border
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 128, 128);
            ctx.strokeStyle = '#cccccc';
            ctx.lineWidth = 5;
            ctx.strokeRect(0, 0, 128, 128);
            
            // Dot color
            ctx.fillStyle = '#000000';
            
            const drawDot = (x, y) => {
                ctx.beginPath();
                ctx.arc(x, y, 12, 0, Math.PI * 2);
                ctx.fill();
            };
            
            const cx = 64, cy = 64, offset = 35;
            
            if (value === 1) {
                drawDot(cx, cy);
            } else if (value === 2) {
                drawDot(cx - offset, cy - offset);
                drawDot(cx + offset, cy + offset);
            } else if (value === 3) {
                drawDot(cx - offset, cy - offset);
                drawDot(cx, cy);
                drawDot(cx + offset, cy + offset);
            } else if (value === 4) {
                drawDot(cx - offset, cy - offset);
                drawDot(cx + offset, cy - offset);
                drawDot(cx - offset, cy + offset);
                drawDot(cx + offset, cy + offset);
            } else if (value === 5) {
                drawDot(cx - offset, cy - offset);
                drawDot(cx + offset, cy - offset);
                drawDot(cx, cy);
                drawDot(cx - offset, cy + offset);
                drawDot(cx + offset, cy + offset);
            } else if (value === 6) {
                drawDot(cx - offset, cy - 25);
                drawDot(cx + offset, cy - 25);
                drawDot(cx - offset, cy);
                drawDot(cx + offset, cy);
                drawDot(cx - offset, cy + 25);
                drawDot(cx + offset, cy + 25);
            }
            
            textures.push(new THREE.CanvasTexture(canvas));
        }
        
        const geometry = new THREE.BoxGeometry(size, size, size);
        
        // Create materials for each face
        const materials = [
            new THREE.MeshStandardMaterial({ map: textures[0] }), // Right
            new THREE.MeshStandardMaterial({ map: textures[1] }), // Left
            new THREE.MeshStandardMaterial({ map: textures[2] }), // Top
            new THREE.MeshStandardMaterial({ map: textures[3] }), // Bottom
            new THREE.MeshStandardMaterial({ map: textures[4] }), // Front
            new THREE.MeshStandardMaterial({ map: textures[5] })  // Back
        ];
        
        const mesh = new THREE.Mesh(geometry, materials);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        
        const shape = new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2));
        
        const body = new CANNON.Body({
            mass: 1,
            shape: shape,
            material: this.diceMaterial,
            angularDamping: 0.5,
            linearDamping: 0.3
        });
        
        body.position.set(0, 8, 0);
        body.quaternion.setFromEuler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        
        this.world.addBody(body);
        
        return { mesh, body, sides: this.sides, resultDeclared: false };
    }

    updatePinsAndBins() {
        this.pins.forEach(pin => {
            pin.mesh.position.copy(pin.body.position);
            pin.mesh.quaternion.copy(pin.body.quaternion);
        });
        
        this.bins.forEach(bin => {
            bin.mesh.position.copy(bin.body.position);
            bin.mesh.quaternion.copy(bin.body.quaternion);
        });
        
        this.walls.forEach(wall => {
            wall.mesh.position.copy(wall.body.position);
            wall.mesh.quaternion.copy(wall.body.quaternion);
        });
    }
    setupInput() {
        const sidesInput = document.getElementById('sides');
        if (sidesInput) {
            this.sides = parseInt(sidesInput.value) || 6;
        }
        
        const rollBtn = document.getElementById('rollBtn');
        if (rollBtn) {
            rollBtn.addEventListener('click', () => this.rollDice());
        }
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        const rollBtn = document.getElementById('rollBtn');
        if (rollBtn) {
            rollBtn.addEventListener('click', () => this.rollDice());
        }
    }

    rollDice() {
        if (this.isRolling) return;
        
        this.isRolling = true;
        
        if (this.dice && this.dice.length > 0) {
            this.dice.forEach(die => {
                die.body.position.set(0, 8, 0);
                die.body.velocity.set((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4);
                die.body.angularVelocity.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
                die.body.quaternion.setFromEuler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                die.resultDeclared = false;
            });
        }
        
        setTimeout(() => {
            this.isRolling = false;
        }, 5000);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.world.step(1/60);
        
        this.updatePinsAndBins();
        
        if (this.dice && this.dice.length > 0) {
            this.dice.forEach(die => {
                die.mesh.position.copy(die.body.position);
                die.mesh.quaternion.copy(die.body.quaternion);
                this.checkDiceResult(die);
            });
        }
        
        // Simple camera rotation for visual effect
        if (!this.isRolling && this.dice && this.dice.length > 0) {
            this.cameraOrbitTime += 0.005;
            this.camera.position.x = Math.sin(this.cameraOrbitTime) * 10;
            this.camera.position.z = Math.cos(this.cameraOrbitTime) * 10;
            this.camera.position.y = 5;
            this.camera.lookAt(0, 0, 0);
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    checkDiceResult(die) {
        if (die.resultDeclared) return;
        
        if (die.body.velocity.length() < 0.1 && Math.abs(die.body.velocity.y) < 0.1 && Math.abs(die.mesh.position.y + 0.5) < 0.5) {
            let hitBin = false;
            for (let i = 0; i < this.bins.length; i++) {
                const bin = this.bins[i];
                if (die.mesh.position.x >= bin.x - bin.width/2 && 
                    die.mesh.position.x <= bin.x + bin.width/2) {
                    this.displayResult(die.sides, bin.multiplier);
                    hitBin = true;
                    die.resultDeclared = true;
                    break;
                }
            }
            if (!hitBin && die.mesh.position.y < -5) {
                this.displayResult(die.sides, 0);
                die.resultDeclared = true;
            }
        }
    }

    displayResult(sides, multiplier) {
        const resultEl = document.getElementById('result');
        if (!resultEl) return;
        
        const dieValue = Math.floor(Math.random() * sides) + 1;
        const displayMultiplier = multiplier >= 1 ? multiplier : 'x' + multiplier;
        
        resultEl.textContent = `Rolled ${dieValue} x ${displayMultiplier}`;
        resultEl.classList.add('show');
        
        setTimeout(() => {
            resultEl.classList.remove('show');
        }, 2000);
    }
}

let diceRoller;
document.addEventListener('DOMContentLoaded', () => {
    diceRoller = new DiceRoller();
    diceRoller.init();
});
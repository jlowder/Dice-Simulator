class DiceRoller {
    constructor() {
        this.dice = [];
        this.isRolling = false;
        this.sides = 6;
        this.cameraOrbitTime = 0;
    }

    init() {
        this.initThreeJS();
        this.initCannonJS();
        this.setupInput();
        this.setupEventListeners();
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

    initCannonJS() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0);
        
        this.diceMaterial = new CANNON.Material('dice');
        this.floorMaterial = new CANNON.Material('floor');
        
        const diceFloorContact = new CANNON.ContactMaterial(
            this.diceMaterial,
            this.floorMaterial,
            { friction: 0.5, restitution: 0.4 }
        );
        this.world.addContactMaterial(diceFloorContact);
        
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
        const size = 2;
        
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
        
        body.position.set(0, 2, 0);
        body.quaternion.setFromEuler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        
        this.world.addBody(body);
        
        return { mesh, body, sides: this.sides };
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
                die.body.position.set(0, 5, 0);
                die.body.velocity.set(0, 0, 0);
                die.body.angularVelocity.set(0, 0, 0);
                die.body.quaternion.setFromEuler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                
                const impulse = new CANNON.Vec3(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10
                );
                die.body.applyImpulse(impulse, new CANNON.Vec3(0, 0, 0));
                
                const angularVel = new CANNON.Vec3(
                    (Math.random() - 0.5) * 20,
                    (Math.random() - 0.5) * 20,
                    (Math.random() - 0.5) * 20
                );
                die.body.angularVelocity = angularVel;
            });
        }
        
        setTimeout(() => {
            this.isRolling = false;
        }, 3000);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.world.step(1/60);
        
        if (this.dice && this.dice.length > 0) {
            this.dice.forEach(die => {
                die.mesh.position.copy(die.body.position);
                die.mesh.quaternion.copy(die.body.quaternion);
            });
        }
        
        // Simple camera rotation for visual effect
        if (!this.isRolling && this.dice && this.dice.length > 0) {
            this.cameraOrbitTime += 0.005;
            this.camera.position.x = Math.sin(this.cameraOrbitTime) * 10;
            this.camera.position.z = Math.cos(this.cameraOrbitTime) * 10;
            this.camera.lookAt(0, 0, 0);
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

let diceRoller;
document.addEventListener('DOMContentLoaded', () => {
    diceRoller = new DiceRoller();
    diceRoller.init();
});
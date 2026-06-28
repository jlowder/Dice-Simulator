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
    this.PIN_DEPTH = 10;
    this.WALL_X = 28;
    this.WALL_HEIGHT = 60;
    this.WALL_DEPTH = 10;
    this.BIN_Y = -12;
    this.DICE_SIZE = 1.5;
    this.SPAWN_Y = 40;

    // Camera constants
    this.CAMERA_DEFAULT_POS = new THREE.Vector3(0, 12, 40);
    this.CAMERA_DEFAULT_LOOKAT = new THREE.Vector3(0, 12, 0);
    this.CAMERA_LERP_FACTOR = 0.1;

    this.cameraTargetPos = this.CAMERA_DEFAULT_POS.clone();
    this.cameraTargetLookAt = this.CAMERA_DEFAULT_LOOKAT.clone();
    this.cameraCurrentLookAt = this.CAMERA_DEFAULT_LOOKAT.clone();
    this.isZoomedIn = false;

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

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.camera.position.copy(this.CAMERA_DEFAULT_POS);
    this.camera.lookAt(this.CAMERA_DEFAULT_LOOKAT);

    const canvas = document.getElementById("canvas");
    if (!canvas) {
      console.error("Canvas element not found");
      return;
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
    });
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
      roughness: 0.9,
    });

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -10.1;
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
    const sideLen = radius * 0.707;
    const pinGeometry = new THREE.BoxGeometry(
      sideLen * 2,
      sideLen * 2,
      this.PIN_DEPTH,
    );
    const pinMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.6,
      roughness: 0.4,
    });

    const pinMesh = new THREE.Mesh(pinGeometry, pinMaterial);
    pinMesh.position.set(x, y, 0);
    pinMesh.rotation.set(0, 0, Math.PI / 4);
    pinMesh.castShadow = true;
    this.scene.add(pinMesh);

    // Use a Box shape rotated as a diamond for better collision behavior in Cannon.js
    const pinShape = new CANNON.Box(
      new CANNON.Vec3(sideLen, sideLen, this.PIN_DEPTH / 2),
    );
    const pinBody = new CANNON.Body({
      mass: 0,
      shape: pinShape,
      material: this.pinMaterial,
    });
    pinBody.position.set(x, y, 0);

    const quat = new CANNON.Quaternion();
    quat.setFromEuler(0, 0, Math.PI / 4);
    pinBody.quaternion.copy(quat);

    this.world.addBody(pinBody);
    this.pins.push({ mesh: pinMesh, body: pinBody });
  }

  createTransparentWalls() {
    const wallThickness = 2;

    // Side walls
    this.createWall(
      -this.WALL_X,
      wallThickness,
      this.WALL_HEIGHT,
      0,
      this.WALL_DEPTH,
    );
    this.createWall(
      this.WALL_X,
      wallThickness,
      this.WALL_HEIGHT,
      0,
      this.WALL_DEPTH,
    );

    // Front and back walls
    this.createWall(
      0,
      this.WALL_X * 2,
      this.WALL_HEIGHT,
      this.WALL_DEPTH / 2,
      0.5,
      0.05,
    );
    this.createWall(
      0,
      this.WALL_X * 2,
      this.WALL_HEIGHT,
      -this.WALL_DEPTH / 2,
      0.5,
      0.05,
    );
  }

  createWall(x, width, height, z, depth, opacity = 0.3) {
    const wallGeometry = new THREE.BoxGeometry(width, height, depth);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.1,
      roughness: 0.8,
      transparent: true,
      opacity: opacity,
    });

    const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
    wallMesh.position.set(x, height / 2 - 10, z);
    this.scene.add(wallMesh);

    const wallShape = new CANNON.Box(
      new CANNON.Vec3(width / 2, height / 2, depth / 2),
    );
    const wallBody = new CANNON.Body({
      mass: 0,
      shape: wallShape,
      material: this.wallMaterial,
    });
    wallBody.position.set(x, height / 2 - 10, z);
    this.world.addBody(wallBody);

    this.walls.push({ mesh: wallMesh, body: wallBody });
  }

  createBinCollectors() {
    const numBins = 11;
    const binWidth = 5.0;
    const binXStart = (-numBins * binWidth) / 2;

    this.binMultipliers = [10, 5, 2, 1, 0.5, 0.2, 0.5, 1, 2, 5, 10];

    for (let i = 0; i < numBins; i++) {
      const x = binXStart + (i + 0.5) * binWidth;
      this.createBin(x, this.BIN_Y, binWidth, 4, i);
    }
  }

  createBin(x, y, width, height, i) {
    const binGeometry = new THREE.BoxGeometry(width, height, this.WALL_DEPTH);
    const binMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a6fa5,
      metalness: 0.3,
      roughness: 0.7,
    });

    const binMesh = new THREE.Mesh(binGeometry, binMaterial);
    binMesh.position.set(x, y, 0);
    this.scene.add(binMesh);

    const binShape = new CANNON.Box(
      new CANNON.Vec3(width / 2, height / 2, this.WALL_DEPTH / 2),
    );
    const binBody = new CANNON.Body({
      mass: 0,
      shape: binShape,
      material: this.binMaterial,
    });
    binBody.position.set(x, y, 0);
    this.world.addBody(binBody);

    this.bins.push({
      mesh: binMesh,
      body: binBody,
      x: x,
      y: y,
      width: width,
      multiplier: this.binMultipliers[i] || 1,
    });
  }

  initCannonJS() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
    this.world.allowSleep = true;

    this.diceMaterial = new CANNON.Material("dice");
    this.pinMaterial = new CANNON.Material("pin");
    this.binMaterial = new CANNON.Material("bin");
    this.wallMaterial = new CANNON.Material("wall");
    this.floorMaterial = new CANNON.Material("floor");

    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.diceMaterial, this.floorMaterial, {
        friction: 0.5,
        restitution: 0.4,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.diceMaterial, this.pinMaterial, {
        friction: 0.0,
        restitution: 0.8,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.diceMaterial, this.wallMaterial, {
        friction: 0.1,
        restitution: 0.5,
      }),
    );

    this.floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    this.floorBody.position.set(0, -10.1, 0);
    this.floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.floorBody.material = this.floorMaterial;
    this.world.addBody(this.floorBody);
  }

  createDice() {
    if (this.dice && this.dice.length > 0) {
      this.dice.forEach((die) => {
        this.scene.remove(die.mesh);
        this.world.removeBody(die.body);
      });
    }
    this.dice = [this.createSingleDie()];
  }

  createSingleDie() {
    const size = this.DICE_SIZE;
    if (this.sides === 6) {
      return this.createD6(size);
    } else if (this.sides === 20) {
      return this.createD20(size);
    }
  }

  createD6(size) {
    const textures = [];
    const faceValues = [1, 6, 2, 5, 3, 4];

    for (let value of faceValues) {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");

      // Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 128, 128);

      // Border with rounded look
      ctx.strokeStyle = "#bbbbbb";
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, 120, 120);

      ctx.fillStyle = "#111111";

      const drawDot = (x, y) => {
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
      };

      const cx = 64,
        cy = 64,
        offset = 32;
      if (value === 1) drawDot(cx, cy);
      else if (value === 2) {
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
        drawDot(cx - offset, cy - offset);
        drawDot(cx + offset, cy - offset);
        drawDot(cx - offset, cy);
        drawDot(cx + offset, cy);
        drawDot(cx - offset, cy + offset);
        drawDot(cx + offset, cy + offset);
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      textures.push(texture);
    }

    const materials = textures.map(
      (tex) => new THREE.MeshStandardMaterial({ map: tex }),
    );
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      materials,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2)),
      material: this.diceMaterial,
      angularDamping: 0.15,
      linearDamping: 0.1,
      allowSleep: true,
      sleepSpeedLimit: 0.1,
      sleepTimeLimit: 0.5,
    });

    body.position.set(0, this.SPAWN_Y, 0);
    body.quaternion.setFromEuler(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    );
    this.world.addBody(body);

    return {
      mesh,
      body,
      sides: 6,
      resultDeclared: false,
      stableTime: 0,
    };
  }

  createD20(size) {
    const radius = size * 0.9;
    let geometry = new THREE.IcosahedronGeometry(radius);
    if (geometry.index) {
      geometry = geometry.toNonIndexed();
    }

    const uvs = new Float32Array(geometry.attributes.position.count * 2);
    for (let i = 0; i < geometry.attributes.position.count; i += 3) {
      uvs[i * 2] = 0.5;
      uvs[i * 2 + 1] = 1.0;
      uvs[i * 2 + 2] = 0.0;
      uvs[i * 2 + 3] = 0.0;
      uvs[i * 2 + 4] = 1.0;
      uvs[i * 2 + 5] = 0.0;
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

    const materials = [];
    for (let i = 1; i <= 20; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");

      // Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 128, 128);

      // Face outline
      ctx.strokeStyle = "#bbbbbb";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(64, 0);
      ctx.lineTo(0, 128);
      ctx.lineTo(128, 128);
      ctx.closePath();
      ctx.stroke();

      // Number
      ctx.fillStyle = "#111111";
      ctx.font = "bold 60px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const text = i.toString();
      ctx.fillText(text, 64, 80);

      // Underline for 6 and 9 to avoid confusion
      if (i === 6 || i === 9) {
        ctx.strokeStyle = "#111111";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(40, 112);
        ctx.lineTo(88, 112);
        ctx.stroke();
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      materials.push(new THREE.MeshStandardMaterial({ map: texture }));
    }

    for (let i = 0; i < 20; i++) {
      geometry.addGroup(i * 3, 3, i);
    }

    const mesh = new THREE.Mesh(geometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const tempGeo = new THREE.IcosahedronGeometry(radius);
    const posAttr = tempGeo.attributes.position;
    const vertexMap = new Map();
    const uniqueVertices = [];

    const getVertexIndex = (x, y, z) => {
      const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
      if (vertexMap.has(key)) return vertexMap.get(key);
      const index = uniqueVertices.length;
      uniqueVertices.push(new CANNON.Vec3(x, y, z));
      vertexMap.set(key, index);
      return index;
    };

    const faces = [];
    if (tempGeo.index) {
      const indexArray = tempGeo.index.array;
      for (let i = 0; i < indexArray.length; i += 3) {
        faces.push([
          getVertexIndex(posAttr.getX(indexArray[i]), posAttr.getY(indexArray[i]), posAttr.getZ(indexArray[i])),
          getVertexIndex(posAttr.getX(indexArray[i + 1]), posAttr.getY(indexArray[i + 1]), posAttr.getZ(indexArray[i + 1])),
          getVertexIndex(posAttr.getX(indexArray[i + 2]), posAttr.getY(indexArray[i + 2]), posAttr.getZ(indexArray[i + 2])),
        ]);
      }
    } else {
      for (let i = 0; i < posAttr.count; i += 3) {
        faces.push([
          getVertexIndex(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)),
          getVertexIndex(posAttr.getX(i + 1), posAttr.getY(i + 1), posAttr.getZ(i + 1)),
          getVertexIndex(posAttr.getX(i + 2), posAttr.getY(i + 2), posAttr.getZ(i + 2)),
        ]);
      }
    }

    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.ConvexPolyhedron(uniqueVertices, faces),
      material: this.diceMaterial,
      angularDamping: 0.2,
      linearDamping: 0.1,
      allowSleep: true,
      sleepSpeedLimit: 0.1,
      sleepTimeLimit: 0.5,
    });

    body.position.set(0, this.SPAWN_Y, 0);
    body.quaternion.setFromEuler(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    );
    this.world.addBody(body);

    return {
      mesh,
      body,
      sides: this.sides,
      resultDeclared: false,
      stableTime: 0,
    };
  }

  updatePhysicsObjects() {
    [...this.pins, ...this.bins, ...this.walls, ...this.dice].forEach((obj) => {
      obj.mesh.position.copy(obj.body.position);
      obj.mesh.quaternion.copy(obj.body.quaternion);
    });
  }

  setupUI() {
    const sidesRadios = document.querySelectorAll('input[name="sides"]');
    const activeRadio = Array.from(sidesRadios).find((r) => r.checked);
    if (activeRadio) {
      this.sides = parseInt(activeRadio.value) || 6;
    }
    sidesRadios.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        if (e.target.checked) {
          this.sides = parseInt(e.target.value) || 6;
          this.createDice();
        }
      });
    });

    const rollBtn = document.getElementById("rollBtn");
    if (rollBtn) {
      rollBtn.addEventListener("click", () => this.rollDice());
    }

    const zoomBtn = document.getElementById("zoomBtn");
    if (zoomBtn) {
      zoomBtn.addEventListener("click", () => this.toggleZoom());
    }

    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  updateCameraTracking() {
    if (this.dice.length === 0) return;
    const die = this.dice[0];

    if (!die.resultDeclared && die.mesh.position.y < this.SPAWN_Y) {
      const trackY = Math.max(this.BIN_Y + 8, die.mesh.position.y);
      this.cameraTargetPos.y = trackY;
      this.cameraTargetLookAt.y = trackY;
      this.cameraTargetPos.x = die.mesh.position.x * 0.5;
      this.cameraTargetLookAt.x = die.mesh.position.x * 0.5;
      this.cameraTargetPos.z = 40;
    }
  }

  rollDice() {
    if (this.isRolling) return;
    this.isRolling = true;
    this.isZoomedIn = false;
    const zoomBtn = document.getElementById("zoomBtn");
    if (zoomBtn) zoomBtn.textContent = "Zoom In";

    this.cameraTargetPos.copy(this.CAMERA_DEFAULT_POS);
    this.cameraTargetLookAt.copy(this.CAMERA_DEFAULT_LOOKAT);

    const resultEl = document.getElementById("result");
    if (resultEl) {
      resultEl.classList.remove("show");
      resultEl.textContent = "";
    }

    this.dice.forEach((die) => {
      die.body.wakeUp();
      die.body.position.set((Math.random() - 0.5) * 10, this.SPAWN_Y, 0);
      die.body.velocity.set((Math.random() - 0.5) * 2, -10, 0);
      die.body.angularVelocity.set(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
      );
      die.body.quaternion.setFromEuler(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );
      die.resultDeclared = false;
      die.stableTime = 0;
    });

  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.world.step(1 / 60);
    this.updatePhysicsObjects();
    this.updateCameraTracking();
    this.dice.forEach((die) => this.checkDiceResult(die));

    this.camera.position.lerp(this.cameraTargetPos, this.CAMERA_LERP_FACTOR);
    this.cameraCurrentLookAt.lerp(this.cameraTargetLookAt, this.CAMERA_LERP_FACTOR);
    this.camera.lookAt(this.cameraCurrentLookAt);

    this.renderer.render(this.scene, this.camera);
  }

  checkDiceResult(die) {
    if (die.resultDeclared) return;

    const isAtBottom = die.mesh.position.y < this.BIN_Y + 8;
    const velocityThreshold = 0.7;
    const angularThreshold = 0.7;
    const isStopped =
      (die.body.velocity.length() < velocityThreshold &&
        die.body.angularVelocity.length() < angularThreshold) ||
      die.body.sleepState === CANNON.Body.SLEEPING;

    if (isStopped && isAtBottom) {
      const roll = this.getDieRollValue(die);
      const alignmentThreshold = 0.94;

      if (roll.alignment < alignmentThreshold) {
        die.body.wakeUp();
        die.body.angularVelocity.set(
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3,
        );
        die.stableTime = 0;
        return;
      }

      die.stableTime++;
      const requiredStableTime = die.sides === 20 ? 80 : 40;
      if (die.stableTime < requiredStableTime) return;

      let multiplier = 1;
      let foundBin = false;
      for (let bin of this.bins) {
        if (die.mesh.position.x >= bin.x - bin.width / 2 && die.mesh.position.x <= bin.x + bin.width / 2) {
          multiplier = bin.multiplier;
          foundBin = true;
          break;
        }
      }

      if (!foundBin) {
        let closestBin = this.bins[0];
        let minDist = Infinity;
        for (let bin of this.bins) {
          const dist = Math.abs(die.mesh.position.x - bin.x);
          if (dist < minDist) {
            minDist = dist;
            closestBin = bin;
          }
        }
        multiplier = closestBin.multiplier;
      }

      this.displayResult(die, multiplier);
      die.resultDeclared = true;
      this.isRolling = false;

      const zoomZ = die.sides === 20 ? 2 : 3;
      const zoomYOffset = die.sides === 20 ? 8 : 10;
      this.cameraTargetPos.set(die.mesh.position.x, die.mesh.position.y + zoomYOffset, zoomZ);
      this.cameraTargetLookAt.copy(die.mesh.position);
    } else {
      die.stableTime = 0;
    }

    const isVelocityStuck = die.body.velocity.length() < 0.5;
    if (isVelocityStuck && !isAtBottom && die.mesh.position.y < this.SPAWN_Y - 5) {
      die.stuckTime = (die.stuckTime || 0) + 1;
      if (die.stuckTime > 30) {
        die.body.wakeUp();
        const nudgeForce = 25;
        die.body.applyImpulse(
          new CANNON.Vec3((Math.random() - 0.5) * nudgeForce, nudgeForce, (Math.random() - 0.5) * 5),
          die.body.position,
        );
        die.body.angularVelocity.set(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
        );
        die.stuckTime = 0;
      }
    } else {
      die.stuckTime = 0;
    }

    if (!die.resultDeclared && die.mesh.position.y < -30) {
      this.displayResult(die, 0);
      die.resultDeclared = true;
      this.isRolling = false;
    }
  }

  getDieRollValue(die) {
    const worldUp = new THREE.Vector3(0, 1, 0);
    if (die.sides === 6) {
      const faceVectors = [
        { vector: new THREE.Vector3(1, 0, 0), value: 1 },
        { vector: new THREE.Vector3(-1, 0, 0), value: 6 },
        { vector: new THREE.Vector3(0, 1, 0), value: 2 },
        { vector: new THREE.Vector3(0, -1, 0), value: 5 },
        { vector: new THREE.Vector3(0, 0, 1), value: 3 },
        { vector: new THREE.Vector3(0, 0, -1), value: 4 },
      ];
      let maxUp = -1;
      let topValue = 1;
      faceVectors.forEach((face) => {
        const worldVector = face.vector.clone().applyQuaternion(die.mesh.quaternion);
        const dot = worldVector.dot(worldUp);
        if (dot > maxUp) {
          maxUp = dot;
          topValue = face.value;
        }
      });
      return { value: topValue, alignment: maxUp };
    } else {
      let maxUp = -1;
      let topValue = 1;
      const geometry = die.mesh.geometry;
      const positions = geometry.attributes.position.array;
      for (let i = 0; i < 20; i++) {
        const vA = new THREE.Vector3(positions[i * 9], positions[i * 9 + 1], positions[i * 9 + 2]);
        const vB = new THREE.Vector3(positions[i * 9 + 3], positions[i * 9 + 4], positions[i * 9 + 5]);
        const vC = new THREE.Vector3(positions[i * 9 + 6], positions[i * 9 + 7], positions[i * 9 + 8]);
        const cb = new THREE.Vector3().subVectors(vC, vB);
        const ab = new THREE.Vector3().subVectors(vA, vB);
        const normal = new THREE.Vector3().crossVectors(cb, ab).normalize().applyQuaternion(die.mesh.quaternion);
        const dot = normal.dot(worldUp);
        if (dot > maxUp) {
          maxUp = dot;
          topValue = i + 1;
        }
      }
      return { value: topValue, alignment: maxUp };
    }
  }

  toggleZoom() {
    if (this.dice.length === 0) return;
    const die = this.dice[0];
    const zoomBtn = document.getElementById("zoomBtn");

    if (!this.isZoomedIn) {
      // Zoom closer
      const zoomZ = die.sides === 20 ? 1 : 1.5;
      const zoomYOffset = die.sides === 20 ? 4 : 5;
      this.cameraTargetPos.set(die.mesh.position.x, die.mesh.position.y + zoomYOffset, zoomZ);
      this.cameraTargetLookAt.copy(die.mesh.position);
      this.isZoomedIn = true;
      if (zoomBtn) zoomBtn.textContent = "Zoom Out";
    } else {
      // Zoom back to result level or default if not settled
      if (die.resultDeclared) {
        const zoomZ = die.sides === 20 ? 2 : 3;
        const zoomYOffset = die.sides === 20 ? 8 : 10;
        this.cameraTargetPos.set(die.mesh.position.x, die.mesh.position.y + zoomYOffset, zoomZ);
        this.cameraTargetLookAt.copy(die.mesh.position);
      } else {
        this.cameraTargetPos.copy(this.CAMERA_DEFAULT_POS);
        this.cameraTargetLookAt.copy(this.CAMERA_DEFAULT_LOOKAT);
      }
      this.isZoomedIn = false;
      if (zoomBtn) zoomBtn.textContent = "Zoom In";
    }
  }

  displayResult(die, multiplier) {
    const resultEl = document.getElementById("result");
    if (!resultEl) return;
    const roll = this.getDieRollValue(die);
    resultEl.textContent = `Rolled ${roll.value}`;
    resultEl.classList.add("show");
    setTimeout(() => {
      resultEl.classList.remove("show");
    }, 5000);
  }
}

let diceRoller;
document.addEventListener("DOMContentLoaded", () => {
  diceRoller = new DiceRoller();
  diceRoller.init();
});

import * as THREE from 'three';
import { PITCH_CONFIG } from '@games/mini-football';
import type { FootballMatchStateType, FootballPlayerEntityType } from '@platform/sdk-core';

export const HUMAN_PLAYER_COLORS = [
  { hex: 0x00e5ff, css: '#00e5ff', name: 'Cyan' },
  { hex: 0xffd600, css: '#ffd600', name: 'Sarı' },
  { hex: 0xff2d55, css: '#ff2d55', name: 'Kırmızı' },
  { hex: 0x00e676, css: '#00e676', name: 'Yeşil' },
  { hex: 0xff6d00, css: '#ff6d00', name: 'Turuncu' },
  { hex: 0xd500f9, css: '#d500f9', name: 'Mor' }
];

// Diverse skin tones & hair colors for authentic Mini Football squad variety
const SKIN_TONES = ['#f5d0b5', '#e8b590', '#c68652', '#8d5524', '#f1c27d'];
const HAIR_COLORS = [0x171717, 0x3d2314, 0x7c4728, 0xca8a04, 0x92400e];

interface PlayerVisual {
  group: THREE.Group;
  characterGroup: THREE.Group;
  torsoMesh: THREE.Mesh;
  headGroup: THREE.Group;
  headMesh: THREE.Mesh;
  hairGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  groundShadow: THREE.Mesh;
  selectionRing: THREE.Mesh;
  arrowMesh: THREE.Mesh;
  nameSprite?: THREE.Sprite;
  targetPos: THREE.Vector3;
  targetAngle: number;
  lastPos: THREE.Vector3;
  isHuman: boolean;
  humanColorHex: number;
  humanColorCss: string;
  hasBall: boolean;
  isStunned: boolean;
  isTackling: boolean;
  isSprinting: boolean;
  lastControlName: string;
}

export class FootballRenderer3D {
  private container: HTMLElement;
  private minimapCanvas?: HTMLCanvasElement;
  private minimapCtx?: CanvasRenderingContext2D | null;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animFrameId?: number;

  private ballMesh: THREE.Mesh;
  private ballShadow: THREE.Mesh;
  private ballTargetPos = new THREE.Vector3(0, PITCH_CONFIG.ballRadius, 0);
  private ballLastPos = new THREE.Vector3(0, PITCH_CONFIG.ballRadius, 0);

  private playersMap = new Map<string, PlayerVisual>();
  private sessionColorMap = new Map<string, number>();

  // Corner flags & stadium decorations
  private cornerFlags: THREE.Mesh[] = [];

  // Camera tracking
  private cameraTarget = new THREE.Vector3(0, 0, 0);
  private cameraLookAt = new THREE.Vector3(0, 0, 0);

  // Cached materials & textures
  private ballTexture: THREE.CanvasTexture;
  private netTexture: THREE.CanvasTexture;
  private netMat: THREE.MeshStandardMaterial;
  private postMat: THREE.MeshStandardMaterial;

  constructor(container: HTMLElement, minimapCanvas?: HTMLCanvasElement) {
    this.container = container;
    this.minimapCanvas = minimapCanvas;
    if (minimapCanvas) {
      this.minimapCtx = minimapCanvas.getContext('2d');
    }

    // 1. Scene & Atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#070d18');
    this.scene.fog = new THREE.FogExp2('#070d18', 0.007);

    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(38, aspect, 0.5, 1000);
    this.camera.position.set(0, 36, 32); // Isometric dynamic broadcast view

    // 2. High-Performance Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // 3. Shared Textures & Materials
    this.ballTexture = this.generateBallTexture();
    this.netTexture = this.generateNetTexture();

    this.postMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.25
    });

    this.netMat = new THREE.MeshStandardMaterial({
      map: this.netTexture,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0.05
    });

    // 4. Stadium Floodlighting (Vibrant Mini Football style)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.05);
    this.scene.add(ambientLight);

    // Main stadium sun / key light
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight1.position.set(35, 60, 25);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    dirLight1.shadow.camera.near = 10;
    dirLight1.shadow.camera.far = 130;
    dirLight1.shadow.camera.left = -45;
    dirLight1.shadow.camera.right = 45;
    dirLight1.shadow.camera.top = 55;
    dirLight1.shadow.camera.bottom = -55;
    dirLight1.shadow.bias = -0.0005;
    this.scene.add(dirLight1);

    // Cyan/Blue fill light for stadium broadcast contrast
    const dirLight2 = new THREE.DirectionalLight(0x7dd3fc, 0.6);
    dirLight2.position.set(-35, 45, -25);
    this.scene.add(dirLight2);

    // Warm touchline backlight
    const dirLight3 = new THREE.DirectionalLight(0xfef08a, 0.35);
    dirLight3.position.set(0, 30, -45);
    this.scene.add(dirLight3);

    // 5. Build Pitch, Goals, Dugouts & Grandstands
    this.buildPitch();
    this.buildGoals();
    this.buildStadiumSurround();
    this.buildCornerFlags();
    this.buildDugouts();

    // 6. 3D Telstar Soccer Ball with authentic 32-panel pattern
    const ballGeo = new THREE.SphereGeometry(PITCH_CONFIG.ballRadius, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({
      map: this.ballTexture,
      roughness: 0.35,
      metalness: 0.08
    });
    this.ballMesh = new THREE.Mesh(ballGeo, ballMat);
    this.ballMesh.castShadow = true;
    this.ballMesh.position.set(0, PITCH_CONFIG.ballRadius, 0);
    this.scene.add(this.ballMesh);

    // Soft dynamic ground drop shadow under ball
    const shadowGeo = new THREE.CircleGeometry(PITCH_CONFIG.ballRadius * 1.15, 24);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x051b11,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    this.ballShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.y = 0.02;
    this.scene.add(this.ballShadow);

    // 7. Resize listener & loop
    window.addEventListener('resize', this.onResize);
    this.renderLoop();
  }

  // ═══════════════════════════════════════════════════════════
  // PITCH & STADIUM BUILDERS (MINI FOOTBALL LUSH LAWN STYLE)
  // ═══════════════════════════════════════════════════════════

  private generateBallTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Clean white leather base
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Classic Telstar black pentagon tiles with metallic depth
    const drawPentagon = (cx: number, cy: number, r: number) => {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      // Stitching groove outline
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    };

    const pentagonR = 25;
    const positions = [
      [64, 64], [192, 64], [320, 64], [448, 64],
      [128, 128], [256, 128], [384, 128],
      [64, 192], [192, 192], [320, 192], [448, 192],
      [0, 128], [512, 128]
    ];

    positions.forEach(([x, y]) => drawPentagon(x, y, pentagonR));

    // Subtle hexagonal stitching lines connecting pentagons
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i][0] - positions[j][0];
        const dy = positions[i][1] - positions[j][1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 80 && dist < 140) {
          ctx.beginPath();
          ctx.moveTo(positions[i][0], positions[i][1]);
          ctx.lineTo(positions[j][0], positions[j][1]);
          ctx.stroke();
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  private generateNetTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.5;

    // Diamond soccer net grid
    const step = 16;
    for (let x = -canvas.height; x < canvas.width + canvas.height; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + canvas.height, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, canvas.height);
      ctx.lineTo(x + canvas.height, 0);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 4);
    return texture;
  }

  private buildPitch() {
    const width = PITCH_CONFIG.width;
    const length = PITCH_CONFIG.length;

    // Outer warm turf border (stadium floor)
    const apronGeo = new THREE.PlaneGeometry(width + 22, length + 26);
    const apronMat = new THREE.MeshStandardMaterial({
      color: 0x0f3823,
      roughness: 0.95
    });
    const apron = new THREE.Mesh(apronGeo, apronMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.05;
    apron.receiveShadow = true;
    this.scene.add(apron);

    // Procedural Lush Mowed Turf Texture (Mini Football high saturation green)
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d')!;

    // Alternating mower stripes with subtle micro-checker grass grain
    const stripes = 18;
    const stripeH = canvas.height / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1eb35a' : '#179c4c'; // Saturated lush lawn
      ctx.fillRect(0, i * stripeH, canvas.width, stripeH);

      // Micro grass grain effect
      ctx.fillStyle = i % 2 === 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(21, 128, 61, 0.12)';
      for (let g = 0; g < 4; g++) {
        ctx.fillRect(0, i * stripeH + g * (stripeH / 4), canvas.width, stripeH / 8);
      }
    }

    // High-contrast clean white chalk pitch lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const padX = 40;
    const padY = 40;
    const pW = canvas.width - padX * 2;
    const pH = canvas.height - padY * 2;

    // Perimeter touchlines
    ctx.strokeRect(padX, padY, pW, pH);

    // Halfway line
    ctx.beginPath();
    ctx.moveTo(padX, canvas.height / 2);
    ctx.lineTo(canvas.width - padX, canvas.height / 2);
    ctx.stroke();

    // Center circle & Center spot
    const centerRadius = (pH * 9) / length;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, centerRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 13, 0, Math.PI * 2);
    ctx.fill();

    // Penalty areas (North and South)
    const penW = (pW * PITCH_CONFIG.penaltyWidth) / width;
    const penH = (pH * PITCH_CONFIG.penaltyLength) / length;

    // Blue goal penalty box (North)
    ctx.strokeRect(canvas.width / 2 - penW / 2, padY, penW, penH);
    // Red goal penalty box (South)
    ctx.strokeRect(canvas.width / 2 - penW / 2, padY + pH - penH, penW, penH);

    // 6-yard Goal boxes
    const goalBoxW = penW * 0.52;
    const goalBoxH = penH * 0.42;
    ctx.strokeRect(canvas.width / 2 - goalBoxW / 2, padY, goalBoxW, goalBoxH);
    ctx.strokeRect(canvas.width / 2 - goalBoxW / 2, padY + pH - goalBoxH, goalBoxW, goalBoxH);

    // Penalty spots
    const penSpotDist = (pH * 11) / length;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, padY + penSpotDist, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(canvas.width / 2, padY + pH - penSpotDist, 9, 0, Math.PI * 2);
    ctx.fill();

    // Penalty D arcs
    ctx.beginPath();
    ctx.arc(canvas.width / 2, padY + penSpotDist, centerRadius * 0.75, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(canvas.width / 2, padY + pH - penSpotDist, centerRadius * 0.75, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();

    // 4 Corner arcs
    const cornerR = 28;
    ctx.beginPath();
    ctx.arc(padX, padY, cornerR, 0, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(padX + pW, padY, cornerR, Math.PI / 2, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(padX, padY + pH, cornerR, -Math.PI / 2, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(padX + pW, padY + pH, cornerR, Math.PI, Math.PI * 1.5);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;

    const pitchGeo = new THREE.PlaneGeometry(width, length);
    const pitchMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.65,
      metalness: 0.05
    });

    const pitch = new THREE.Mesh(pitchGeo, pitchMat);
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    this.scene.add(pitch);
  }

  private buildGoals() {
    const halfWidth = PITCH_CONFIG.goalWidth / 2;
    const height = PITCH_CONFIG.goalHeight;
    const depth = PITCH_CONFIG.goalDepth;
    const halfLength = PITCH_CONFIG.length / 2;
    const postRadius = 0.18;

    // Metallic glossy rear stanchion material
    const supportMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.3,
      metalness: 0.7
    });

    // Create Goal at each end (dir = -1 for Blue Goal North, +1 for Red Goal South)
    [-1, 1].forEach((dir) => {
      const goalGroup = new THREE.Group();
      const zPos = halfLength * dir;

      // 1. Upright Posts (Left & Right)
      const postGeo = new THREE.CylinderGeometry(postRadius, postRadius, height, 20);
      const leftPost = new THREE.Mesh(postGeo, this.postMat);
      leftPost.position.set(-halfWidth, height / 2, 0);
      leftPost.castShadow = true;
      goalGroup.add(leftPost);

      const rightPost = new THREE.Mesh(postGeo, this.postMat);
      rightPost.position.set(halfWidth, height / 2, 0);
      rightPost.castShadow = true;
      goalGroup.add(rightPost);

      // 2. Crossbar
      const barGeo = new THREE.CylinderGeometry(postRadius, postRadius, PITCH_CONFIG.goalWidth + postRadius * 2, 20);
      const crossbar = new THREE.Mesh(barGeo, this.postMat);
      crossbar.rotation.z = Math.PI / 2;
      crossbar.position.set(0, height, 0);
      crossbar.castShadow = true;
      goalGroup.add(crossbar);

      // 3. Rounded Corner Elbows (Mini Football style smooth posts)
      const elbowGeo = new THREE.SphereGeometry(postRadius * 1.05, 16, 16);
      const leftElbow = new THREE.Mesh(elbowGeo, this.postMat);
      leftElbow.position.set(-halfWidth, height, 0);
      goalGroup.add(leftElbow);

      const rightElbow = new THREE.Mesh(elbowGeo, this.postMat);
      rightElbow.position.set(halfWidth, height, 0);
      goalGroup.add(rightElbow);

      // 4. Rear Net Stanchion Tubular Frame (Deep 3D Goal Box)
      const stanchionRadius = 0.09;

      // Left & Right Top Support Arms reaching backwards
      const armGeo = new THREE.CylinderGeometry(stanchionRadius, stanchionRadius, depth * 0.9, 12);
      const leftArm = new THREE.Mesh(armGeo, supportMat);
      leftArm.rotation.x = (Math.PI / 2) * dir;
      leftArm.position.set(-halfWidth, height - 0.1, (depth * 0.45) * dir);
      goalGroup.add(leftArm);

      const rightArm = new THREE.Mesh(armGeo, supportMat);
      rightArm.rotation.x = (Math.PI / 2) * dir;
      rightArm.position.set(halfWidth, height - 0.1, (depth * 0.45) * dir);
      goalGroup.add(rightArm);

      // Ground Rear Frame
      const groundArmGeo = new THREE.CylinderGeometry(stanchionRadius, stanchionRadius, depth, 12);
      const leftGround = new THREE.Mesh(groundArmGeo, supportMat);
      leftGround.rotation.x = (Math.PI / 2) * dir;
      leftGround.position.set(-halfWidth, 0.05, (depth * 0.5) * dir);
      goalGroup.add(leftGround);

      const rightGround = new THREE.Mesh(groundArmGeo, supportMat);
      rightGround.rotation.x = (Math.PI / 2) * dir;
      rightGround.position.set(halfWidth, 0.05, (depth * 0.5) * dir);
      goalGroup.add(rightGround);

      // Rear cross pipe at bottom
      const rearBarGeo = new THREE.CylinderGeometry(stanchionRadius, stanchionRadius, PITCH_CONFIG.goalWidth, 12);
      const rearBar = new THREE.Mesh(rearBarGeo, supportMat);
      rearBar.rotation.z = Math.PI / 2;
      rearBar.position.set(0, 0.05, depth * dir);
      goalGroup.add(rearBar);

      // 5. Deep Realistic 3D Net Mesh (Back, Top, Left & Right sides)
      // Back Net
      const backNetGeo = new THREE.PlaneGeometry(PITCH_CONFIG.goalWidth, height);
      const backNet = new THREE.Mesh(backNetGeo, this.netMat);
      backNet.position.set(0, height / 2, depth * dir);
      goalGroup.add(backNet);

      // Top Net
      const topNetGeo = new THREE.PlaneGeometry(PITCH_CONFIG.goalWidth, depth);
      const topNet = new THREE.Mesh(topNetGeo, this.netMat);
      topNet.rotation.x = Math.PI / 2;
      topNet.position.set(0, height, (depth / 2) * dir);
      goalGroup.add(topNet);

      // Left & Right Net Sides
      const sideNetGeo = new THREE.PlaneGeometry(depth, height);
      const leftSideNet = new THREE.Mesh(sideNetGeo, this.netMat);
      leftSideNet.rotation.y = Math.PI / 2;
      leftSideNet.position.set(-halfWidth, height / 2, (depth / 2) * dir);
      goalGroup.add(leftSideNet);

      const rightSideNet = new THREE.Mesh(sideNetGeo, this.netMat);
      rightSideNet.rotation.y = Math.PI / 2;
      rightSideNet.position.set(halfWidth, height / 2, (depth / 2) * dir);
      goalGroup.add(rightSideNet);

      // 6. Corner Target Padding (Mini Football visual detail)
      const padGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const padMat = new THREE.MeshStandardMaterial({
        color: dir === -1 ? 0x2563eb : 0xdc2626,
        roughness: 0.4
      });
      const padL = new THREE.Mesh(padGeo, padMat);
      padL.position.set(-halfWidth + 0.3, height - 0.3, 0.1 * dir);
      goalGroup.add(padL);

      const padR = new THREE.Mesh(padGeo, padMat);
      padR.position.set(halfWidth - 0.3, height - 0.3, 0.1 * dir);
      goalGroup.add(padR);

      goalGroup.position.set(0, 0, zPos);
      this.scene.add(goalGroup);
    });
  }

  private buildCornerFlags() {
    const halfW = PITCH_CONFIG.width / 2;
    const halfL = PITCH_CONFIG.length / 2;

    const corners = [
      [-halfW, -halfL],
      [halfW, -halfL],
      [-halfW, halfL],
      [halfW, halfL]
    ];

    const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

    // Checkerboard corner flag cloth
    const flagCanvas = document.createElement('canvas');
    flagCanvas.width = 64;
    flagCanvas.height = 48;
    const fctx = flagCanvas.getContext('2d')!;
    fctx.fillStyle = '#ef4444';
    fctx.fillRect(0, 0, 32, 24);
    fctx.fillRect(32, 24, 32, 24);
    fctx.fillStyle = '#facc15';
    fctx.fillRect(32, 0, 32, 24);
    fctx.fillRect(0, 24, 32, 24);

    const flagTexture = new THREE.CanvasTexture(flagCanvas);
    const flagClothMat = new THREE.MeshStandardMaterial({
      map: flagTexture,
      roughness: 0.7,
      side: THREE.DoubleSide
    });

    corners.forEach(([cx, cz]) => {
      const flagGroup = new THREE.Group();
      flagGroup.position.set(cx, 0, cz);

      // Flexible white pole
      const poleGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.8, 8);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 0.9;
      flagGroup.add(pole);

      // Cloth
      const clothGeo = new THREE.PlaneGeometry(0.55, 0.38);
      const cloth = new THREE.Mesh(clothGeo, flagClothMat);
      cloth.position.set(0.28, 1.6, 0);
      flagGroup.add(cloth);

      this.cornerFlags.push(cloth);
      this.scene.add(flagGroup);
    });
  }

  private buildDugouts() {
    // 3D Curved Acrylic Team Benches along Touchline
    const dugoutMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      roughness: 0.2,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.8 });

    [-12, 12].forEach((zPos, idx) => {
      const dugout = new THREE.Group();
      dugout.position.set(-PITCH_CONFIG.width / 2 - 4.5, 0, zPos);
      dugout.rotation.y = Math.PI / 2;

      // Curved canopy roof
      const roofGeo = new THREE.CylinderGeometry(2.4, 2.4, 6.0, 16, 1, false, 0, Math.PI / 2);
      const roof = new THREE.Mesh(roofGeo, dugoutMat);
      roof.rotation.z = Math.PI / 2;
      roof.position.set(0, 1.4, 0);
      dugout.add(roof);

      // Bench Frame
      const baseGeo = new THREE.BoxGeometry(1.2, 0.2, 5.8);
      const base = new THREE.Mesh(baseGeo, frameMat);
      base.position.set(0.5, 0.1, 0);
      dugout.add(base);

      // 4 Team Bucket Seats
      const seatMat = new THREE.MeshStandardMaterial({
        color: idx === 0 ? 0x2563eb : 0xdc2626,
        roughness: 0.4
      });
      for (let s = -2; s <= 2; s += 1.3) {
        const seatGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const seat = new THREE.Mesh(seatGeo, seatMat);
        seat.position.set(0.6, 0.45, s);
        dugout.add(seat);
      }

      this.scene.add(dugout);
    });
  }

  private buildStadiumSurround() {
    const width = PITCH_CONFIG.width;
    const length = PITCH_CONFIG.length;

    // 1. Electronic LED Advertising Ribbon Hoardings (Mini Football style)
    const adCanvas = document.createElement('canvas');
    adCanvas.width = 1024;
    adCanvas.height = 128;
    const adCtx = adCanvas.getContext('2d')!;

    // Dark sleek background
    adCtx.fillStyle = '#0a0f1d';
    adCtx.fillRect(0, 0, adCanvas.width, adCanvas.height);

    // Glowing LED brand stripes
    adCtx.fillStyle = '#0284c7';
    adCtx.fillRect(0, 0, adCanvas.width, 10);
    adCtx.fillRect(0, 118, adCanvas.width, 10);

    adCtx.font = '900 42px "Segoe UI", Arial, sans-serif';
    adCtx.fillStyle = '#38bdf8';
    adCtx.fillText('★ MINI FOOTBALL', 30, 80);

    adCtx.fillStyle = '#facc15';
    adCtx.fillText('⚡ PARTY PLATFORM 5v5', 430, 80);

    adCtx.fillStyle = '#4ade80';
    adCtx.fillText('⚽ ARCADE SOCCER', 900, 80);

    const adTexture = new THREE.CanvasTexture(adCanvas);
    adTexture.wrapS = THREE.RepeatWrapping;
    adTexture.repeat.set(3, 1);

    const adMat = new THREE.MeshStandardMaterial({
      map: adTexture,
      roughness: 0.3,
      metalness: 0.2
    });

    const boardH = 1.1;
    const boardGeoX = new THREE.BoxGeometry(0.3, boardH, length + 4);
    const boardGeoZ = new THREE.BoxGeometry(width + 6, boardH, 0.3);

    // Touchline LED Boards (Left & Right)
    const leftBoard = new THREE.Mesh(boardGeoX, adMat);
    leftBoard.position.set(-width / 2 - 2.2, boardH / 2, 0);
    this.scene.add(leftBoard);

    const rightBoard = new THREE.Mesh(boardGeoX, adMat);
    rightBoard.position.set(width / 2 + 2.2, boardH / 2, 0);
    this.scene.add(rightBoard);

    // Behind Goal LED Boards (with opening for goals)
    [-1, 1].forEach((dir) => {
      const zPos = (length / 2 + 3.8) * dir;
      const board = new THREE.Mesh(boardGeoZ, adMat);
      board.position.set(0, boardH / 2, zPos);
      this.scene.add(board);
    });

    // 2. Stadium Grandstand Bleachers & Cheering Crowd (Adds huge authentic stadium depth!)
    const standMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const crowdCanvas = document.createElement('canvas');
    crowdCanvas.width = 512;
    crowdCanvas.height = 128;
    const cctx = crowdCanvas.getContext('2d')!;
    cctx.fillStyle = '#1e293b';
    cctx.fillRect(0, 0, crowdCanvas.width, crowdCanvas.height);

    // Cheering crowd dots (Team colors: Blue, Red, Yellow, White)
    const crowdColors = ['#3b82f6', '#ef4444', '#facc15', '#ffffff', '#10b981', '#f97316'];
    for (let y = 8; y < crowdCanvas.height; y += 12) {
      for (let x = 6; x < crowdCanvas.width; x += 10) {
        cctx.fillStyle = crowdColors[Math.floor(Math.random() * crowdColors.length)];
        cctx.beginPath();
        cctx.arc(x + (Math.random() * 4 - 2), y, 4, 0, Math.PI * 2);
        cctx.fill();
      }
    }
    const crowdTex = new THREE.CanvasTexture(crowdCanvas);
    crowdTex.wrapS = THREE.RepeatWrapping;
    crowdTex.repeat.set(4, 1);
    const crowdMat = new THREE.MeshBasicMaterial({ map: crowdTex });

    // Right Touchline Grandstand (Behind camera view)
    const standGeo = new THREE.BoxGeometry(10, 8, length + 20);
    const rightStand = new THREE.Mesh(standGeo, standMat);
    rightStand.position.set(width / 2 + 10, 3, 0);
    this.scene.add(rightStand);

    const crowdPlane = new THREE.Mesh(new THREE.PlaneGeometry(length + 20, 6), crowdMat);
    crowdPlane.rotation.y = -Math.PI / 2;
    crowdPlane.position.set(width / 2 + 5.1, 4.5, 0);
    this.scene.add(crowdPlane);

    // Left Touchline Grandstand
    const leftStand = new THREE.Mesh(standGeo, standMat);
    leftStand.position.set(-width / 2 - 12, 3, 0);
    this.scene.add(leftStand);

    // 3. 4 Corner Heavy Stadium Floodlight Gantries
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.2 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    [
      [-width / 2 - 8, -length / 2 - 10],
      [width / 2 + 8, -length / 2 - 10],
      [-width / 2 - 8, length / 2 + 10],
      [width / 2 + 8, length / 2 + 10]
    ].forEach(([tx, tz]) => {
      const towerGroup = new THREE.Group();
      towerGroup.position.set(tx, 0, tz);

      // Steel mast
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.65, 26, 8), towerMat);
      mast.position.y = 13;
      towerGroup.add(mast);

      // Crossbars / Truss
      for (let h = 6; h <= 22; h += 5) {
        const cross = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.2), towerMat);
        cross.position.y = h;
        towerGroup.add(cross);
      }

      // Large Floodlight Panel angled towards center pitch
      const panel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.6, 1.0), towerMat);
      panel.position.set(0, 25.5, 0);
      panel.lookAt(0, 0, 0);
      towerGroup.add(panel);

      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.2), lampMat);
      lamp.position.set(0, 25.5, 0.55);
      lamp.lookAt(0, 0, 0);
      towerGroup.add(lamp);

      this.scene.add(towerGroup);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // MINI FOOTBALL 3D CHIBI CHARACTER MODELING (ÖZEL OYUNCU TASARIMI)
  // ═══════════════════════════════════════════════════════════

  private generateFaceTexture(skinTone: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Skin background
    ctx.fillStyle = skinTone;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Large, stylized, lovable anime/chibi cartoon eyes (Mini Football signature)
    const eyeY = 122;
    const eyeSpacing = 44;
    const eyeW = 24;
    const eyeH = 32;

    [-1, 1].forEach((dir) => {
      const eyeX = 128 + dir * eyeSpacing;

      // 1. Sclera (White eye background)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // 2. Dark large iris/pupil
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(eyeX + dir * 2, eyeY, eyeW * 0.72, eyeH * 0.76, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3. Vibrant Azure Iris ring
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.ellipse(eyeX + dir * 2, eyeY, eyeW * 0.48, eyeH * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#030712';
      ctx.beginPath();
      ctx.ellipse(eyeX + dir * 2, eyeY, eyeW * 0.28, eyeH * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();

      // 4. Glossy cartoon sparkle catchlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eyeX + dir * 2 - 5, eyeY - 9, 5.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(eyeX + dir * 2 + 5, eyeY + 5, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // 5. Stylized Eyebrows (Determined gamer expression)
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(eyeX - dir * 22, eyeY - 40);
      ctx.quadraticCurveTo(eyeX, eyeY - 48, eyeX + dir * 22, eyeY - 36);
      ctx.stroke();
    });

    // Rosy athletic cheek blushes
    ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
    ctx.beginPath();
    ctx.ellipse(128 - 58, eyeY + 34, 18, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(128 + 58, eyeY + 34, 18, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Confident athletic smile
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(128, eyeY + 38, 20, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  private generateJerseyTexture(team: 'blue' | 'red' | 'blue_gk' | 'red_gk', number: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    let baseColor = '#1d4ed8'; // Rich Royal Blue
    let stripeColor = '#ffffff';
    let collarColor = '#ffffff';
    let numColor = '#ffffff';

    if (team === 'red') {
      baseColor = '#dc2626'; // Vibrant Red
      stripeColor = '#facc15'; // Golden stripes
      collarColor = '#facc15';
      numColor = '#ffffff';
    } else if (team === 'blue_gk') {
      baseColor = '#10b981'; // High-vis Goalkeeper Emerald
      stripeColor = '#065f46';
      collarColor = '#022c22';
      numColor = '#ffffff';
    } else if (team === 'red_gk') {
      baseColor = '#f59e0b'; // High-vis Goalkeeper Amber
      stripeColor = '#b45309';
      collarColor = '#78350f';
      numColor = '#0f172a';
    }

    // Base Jersey
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Bold dynamic stripes
    ctx.fillStyle = stripeColor;
    const stripeW = 26;
    for (let x = 14; x < canvas.width; x += stripeW * 2) {
      ctx.fillRect(x, 0, stripeW, canvas.height);
    }

    // Ribbed Collar
    ctx.fillStyle = collarColor;
    ctx.fillRect(0, 0, canvas.width, 34);

    // Team Chest Shield / Crest
    ctx.fillStyle = collarColor;
    ctx.beginPath();
    ctx.moveTo(56, 74);
    ctx.lineTo(86, 74);
    ctx.lineTo(86, 102);
    ctx.lineTo(71, 114);
    ctx.lineTo(56, 102);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(71, 92, 8, 0, Math.PI * 2);
    ctx.fill();

    // Squad Number on Back & Chest
    ctx.font = '900 60px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = numColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(number.toString(), 185, 92); // Front mini number

    ctx.font = '900 110px "Segoe UI", Arial, sans-serif';
    ctx.fillText(number.toString(), 128, 185); // Back large number

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  private createPlayerVisual(player: FootballPlayerEntityType): PlayerVisual {
    const group = new THREE.Group();
    const characterGroup = new THREE.Group();
    group.add(characterGroup);

    const isGk = Boolean(player.isGoalkeeper);
    const teamType = isGk
      ? player.team === 'blue'
        ? 'blue_gk'
        : 'red_gk'
      : (player.team as 'blue' | 'red');

    const playerNumber = player.number || (isGk ? 1 : 10);
    const skinIndex = (playerNumber + (player.team === 'red' ? 2 : 0)) % SKIN_TONES.length;
    const skinHexStr = SKIN_TONES[skinIndex];
    const skinColor = new THREE.Color(skinHexStr);

    const hairIndex = (playerNumber * 2) % HAIR_COLORS.length;
    const hairColor = HAIR_COLORS[hairIndex];

    // 1. Soft Circular Ground Drop Shadow
    const shadowGeo = new THREE.CircleGeometry(PITCH_CONFIG.playerRadius * 0.95, 20);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x051b11,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });
    const groundShadow = new THREE.Mesh(shadowGeo, shadowMat);
    groundShadow.rotation.x = -Math.PI / 2;
    groundShadow.position.y = 0.02;
    group.add(groundShadow);

    // 2. Active Selection Ring (Mini Football style glowing dashed ring)
    const ringGeo = new THREE.RingGeometry(0.68, 0.88, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });
    const selectionRing = new THREE.Mesh(ringGeo, ringMat);
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.03;
    selectionRing.visible = false;
    group.add(selectionRing);

    // 3. Chibi Athletic Torso with Authentic Team Jersey Texture
    const jerseyTex = this.generateJerseyTexture(teamType, playerNumber);
    const jerseyMat = new THREE.MeshStandardMaterial({
      map: jerseyTex,
      roughness: 0.45,
      metalness: 0.1
    });

    const torsoGeo = new THREE.CapsuleGeometry(0.38, 0.62, 8, 16);
    const torsoMesh = new THREE.Mesh(torsoGeo, jerseyMat);
    torsoMesh.position.y = 1.05;
    torsoMesh.castShadow = true;
    characterGroup.add(torsoMesh);

    // 4. Athletic Shorts with Side Team Stripes
    const shortsColor = player.team === 'blue' ? 0x0f172a : 0xf8fafc;
    const shortsMat = new THREE.MeshStandardMaterial({
      color: shortsColor,
      roughness: 0.55
    });
    const shortsGeo = new THREE.BoxGeometry(0.66, 0.34, 0.44);
    const shortsMesh = new THREE.Mesh(shortsGeo, shortsMat);
    shortsMesh.position.y = 0.68;
    shortsMesh.castShadow = true;
    characterGroup.add(shortsMesh);

    // Shorts side stripes (color accent)
    const stripeMat = new THREE.MeshStandardMaterial({
      color: player.team === 'blue' ? 0x3b82f6 : 0xdc2626,
      roughness: 0.4
    });
    const sideStripeGeo = new THREE.BoxGeometry(0.68, 0.32, 0.1);
    const sideStripe = new THREE.Mesh(sideStripeGeo, stripeMat);
    sideStripe.position.y = 0.68;
    characterGroup.add(sideStripe);

    // 5. Articulated Legs, High Soccer Socks & 3D Cleats (Boots)
    const sockMat = new THREE.MeshStandardMaterial({
      color: isGk ? (player.team === 'blue' ? 0x10b981 : 0xf59e0b) : (player.team === 'blue' ? 0x2563eb : 0xdc2626),
      roughness: 0.5
    });
    const sockRingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const bootUpperMat = new THREE.MeshStandardMaterial({
      color: player.team === 'blue' ? 0x06b6d4 : 0xf97316, // Vibrant modern neon boots
      roughness: 0.25,
      metalness: 0.2
    });
    const bootSoleMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });

    const createLeg = (xOffset: number) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(xOffset, 0.55, 0);

      // Sock (leg shaft)
      const legGeo = new THREE.CylinderGeometry(0.11, 0.10, 0.44, 12);
      const legMesh = new THREE.Mesh(legGeo, sockMat);
      legMesh.position.y = -0.22;
      legMesh.castShadow = true;
      legGroup.add(legMesh);

      // Sock white ring band near knee (Authentic football look)
      const ringGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.08, 12);
      const ringMesh = new THREE.Mesh(ringGeo, sockRingMat);
      ringMesh.position.y = -0.06;
      legGroup.add(ringMesh);

      // 3D Soccer Cleat (Boot Upper + Soleplate)
      const bootGroup = new THREE.Group();
      bootGroup.position.set(0, -0.45, 0.06);

      const bootUpperGeo = new THREE.BoxGeometry(0.16, 0.12, 0.32);
      const bootUpper = new THREE.Mesh(bootUpperGeo, bootUpperMat);
      bootUpper.castShadow = true;
      bootGroup.add(bootUpper);

      const bootSoleGeo = new THREE.BoxGeometry(0.17, 0.04, 0.34);
      const bootSole = new THREE.Mesh(bootSoleGeo, bootSoleMat);
      bootSole.position.y = -0.06;
      bootGroup.add(bootSole);

      legGroup.add(bootGroup);
      return legGroup;
    };

    const leftLeg = createLeg(-0.19);
    const rightLeg = createLeg(0.19);
    characterGroup.add(leftLeg);
    characterGroup.add(rightLeg);

    // 6. Articulated Arms & Hands / Goalkeeper Gloves (Natural running swing!)
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 });
    const sleeveMat = jerseyMat;
    const gloveMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15, // Bright yellow padded GK gloves
      roughness: 0.35,
      metalness: 0.1
    });

    const createArm = (xOffset: number, isLeft: boolean) => {
      const armGroup = new THREE.Group();
      armGroup.position.set(xOffset, 1.45, 0);
      armGroup.rotation.z = isLeft ? 0.08 : -0.08;

      // Short jersey sleeve
      const sleeveGeo = new THREE.CylinderGeometry(0.12, 0.11, 0.22, 10);
      const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
      sleeve.position.y = -0.08;
      sleeve.castShadow = true;
      armGroup.add(sleeve);

      // Forearm (Skin tone)
      const armGeo = new THREE.CylinderGeometry(0.085, 0.08, 0.28, 10);
      const forearm = new THREE.Mesh(armGeo, skinMat);
      forearm.position.y = -0.28;
      forearm.castShadow = true;
      armGroup.add(forearm);

      // Hand or Chunky Goalkeeper Glove
      if (isGk) {
        const gloveGeo = new THREE.BoxGeometry(0.22, 0.22, 0.14);
        const glove = new THREE.Mesh(gloveGeo, gloveMat);
        glove.position.set(0, -0.44, 0);
        glove.castShadow = true;
        armGroup.add(glove);
      } else {
        const handGeo = new THREE.SphereGeometry(0.09, 10, 10);
        const hand = new THREE.Mesh(handGeo, skinMat);
        hand.position.set(0, -0.42, 0);
        hand.castShadow = true;
        armGroup.add(hand);
      }

      return armGroup;
    };

    const leftArm = createArm(-0.44, true);
    const rightArm = createArm(0.44, false);
    characterGroup.add(leftArm);
    characterGroup.add(rightArm);

    // 7. Prominent Chibi Head with Expressive Face Texture
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.82;

    const faceTexture = this.generateFaceTexture(skinHexStr);
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceTexture,
      roughness: 0.55
    });

    // Slightly oversized cute chibi head sphere (Signature Mini Football ratio)
    const headGeo = new THREE.SphereGeometry(0.38, 24, 24);
    const headMesh = new THREE.Mesh(headGeo, faceMat);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // Cute Ears
    const earGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const leftEar = new THREE.Mesh(earGeo, skinMat);
    leftEar.position.set(-0.36, 0, 0);
    headGroup.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, skinMat);
    rightEar.position.set(0.36, 0, 0);
    headGroup.add(rightEar);

    // 8. 3D Stylized Hairstyles (Multiple distinct cuts for squad personality)
    const hairGroup = new THREE.Group();
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.85 });
    const hairStyle = playerNumber % 3;

    if (hairStyle === 0) {
      // Modern High Fade with Textured Pompadour/Quiff
      const hairBase = new THREE.Mesh(
        new THREE.SphereGeometry(0.39, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2.2),
        hairMat
      );
      hairBase.position.y = 0.04;
      hairGroup.add(hairBase);

      const quiff = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.44), hairMat);
      quiff.position.set(0, 0.38, 0.05);
      hairGroup.add(quiff);
    } else if (hairStyle === 1) {
      // Athletic Sweatband with Textured Afro/Curly Top
      const headbandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.05, 8, 24), headbandMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.12;
      hairGroup.add(band);

      const curlyTop = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2.0),
        hairMat
      );
      curlyTop.position.y = 0.15;
      hairGroup.add(curlyTop);
    } else {
      // Sleek Modern Combed Side-Part
      const hairBase = new THREE.Mesh(
        new THREE.SphereGeometry(0.395, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2.1),
        hairMat
      );
      hairBase.position.set(0.04, 0.05, 0);
      hairGroup.add(hairBase);
    }

    headGroup.add(hairGroup);
    characterGroup.add(headGroup);

    // 9. Mini Football Style Overhead Floating Chevron (`▲`)
    const arrowGeo = new THREE.ConeGeometry(0.38, 0.65, 4);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
    arrowMesh.rotation.x = Math.PI; // point downwards towards player
    arrowMesh.position.y = 2.85;
    arrowMesh.visible = false;
    group.add(arrowMesh);

    this.scene.add(group);

    return {
      group,
      characterGroup,
      torsoMesh,
      headGroup,
      headMesh,
      hairGroup,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      groundShadow,
      selectionRing,
      arrowMesh,
      targetPos: new THREE.Vector3(player.x || 0, 0, player.z || 0),
      lastPos: new THREE.Vector3(player.x || 0, 0, player.z || 0),
      targetAngle: player.angle || 0,
      isHuman: false,
      humanColorHex: 0x00e5ff,
      humanColorCss: '#00e5ff',
      hasBall: false,
      isStunned: false,
      isTackling: false,
      isSprinting: false,
      lastControlName: ''
    };
  }

  private createNameSprite(name: string, team: string, accentColorCss: string, number?: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 340;
    canvas.height = 90;
    const ctx = canvas.getContext('2d')!;

    // Mini Football Floating Player Card Banner
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 90);
    bgGrad.addColorStop(0, team === 'blue' ? 'rgba(30, 58, 138, 0.95)' : 'rgba(153, 27, 27, 0.95)');
    bgGrad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');

    ctx.fillStyle = bgGrad;
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(10, 10, 320, 70, 20);
    } else {
      ctx.rect(10, 10, 320, 70);
    }
    ctx.fill();

    // Vibrant accent border with player's custom neon color
    ctx.strokeStyle = accentColorCss || '#00e5ff';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Text: ★ Nickname (#Number)
    ctx.font = '900 30px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const numStr = number ? ` #${number}` : '';
    const label = `★ ${name}${numStr}`;
    ctx.fillText(label, 170, 45);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3.8, 1.0, 1);
    sprite.position.y = 3.6;

    return sprite;
  }

  // ═══════════════════════════════════════════════════════════
  // STATE SYNC & ANIMATION LOOP
  // ═══════════════════════════════════════════════════════════

  public updateMatchState(match: FootballMatchStateType) {
    if (!match) return;

    // 1. Update Ball Target safely
    if (match.ball) {
      this.ballTargetPos.set(match.ball.x || 0, match.ball.y || PITCH_CONFIG.ballRadius, match.ball.z || 0);
    }

    // 2. Update Players safely
    if (!match.footballPlayers) return;

    const activeIds = new Set<string>();

    match.footballPlayers.forEach((player: FootballPlayerEntityType) => {
      if (!player) return;
      activeIds.add(player.id);
      let visual = this.playersMap.get(player.id);

      if (!visual) {
        visual = this.createPlayerVisual(player);
        this.playersMap.set(player.id, visual);
      }

      visual.targetPos.set(player.x || 0, player.y || 0, player.z || 0);
      visual.targetAngle = player.angle || 0;
      visual.isHuman = Boolean(player.controlledBySessionId);
      visual.hasBall = Boolean(player.hasBall);
      visual.isStunned = Boolean(player.isStunned);
      visual.isTackling = Boolean(player.isTackling);
      visual.isSprinting = Boolean(player.isSprinting);

      // Human assignment: assign distinct neon indicator color
      if (visual.isHuman) {
        let colorIdx = this.sessionColorMap.get(player.controlledBySessionId);
        if (colorIdx === undefined) {
          colorIdx = this.sessionColorMap.size % HUMAN_PLAYER_COLORS.length;
          this.sessionColorMap.set(player.controlledBySessionId, colorIdx);
        }
        const assignedColor = HUMAN_PLAYER_COLORS[colorIdx];
        visual.humanColorHex = assignedColor.hex;
        visual.humanColorCss = assignedColor.css;

        // Apply color to overhead chevron & selection ring
        (visual.arrowMesh.material as THREE.MeshBasicMaterial).color.setHex(assignedColor.hex);
        (visual.selectionRing.material as THREE.MeshBasicMaterial).color.setHex(assignedColor.hex);

        visual.arrowMesh.visible = true;
        visual.selectionRing.visible = true;

        // Update name billboard
        const displayName = player.controlledByName || player.name || 'Oyuncu';
        if (!visual.nameSprite || visual.lastControlName !== displayName) {
          if (visual.nameSprite) {
            visual.group.remove(visual.nameSprite);
            visual.nameSprite.material.dispose();
          }
          visual.nameSprite = this.createNameSprite(displayName, player.team, assignedColor.css, player.number);
          visual.lastControlName = displayName;
          visual.group.add(visual.nameSprite);
        }
        visual.nameSprite.visible = true;
      } else {
        visual.arrowMesh.visible = false;
        visual.selectionRing.visible = false;
        if (visual.nameSprite) {
          visual.nameSprite.visible = false;
        }
      }
    });

    // Remove deleted players
    for (const [id, visual] of this.playersMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(visual.group);
        this.playersMap.delete(id);
      }
    }
  }

  private renderLoop = () => {
    this.animFrameId = requestAnimationFrame(this.renderLoop);

    const time = Date.now() * 0.001;

    // 1. Smoothly interpolate ball position & spin rotation
    this.ballLastPos.copy(this.ballMesh.position);
    this.ballMesh.position.lerp(this.ballTargetPos, 0.38);

    const ballVelX = this.ballMesh.position.x - this.ballLastPos.x;
    const ballVelZ = this.ballMesh.position.z - this.ballLastPos.z;
    this.ballMesh.rotation.z -= ballVelX * 2.8;
    this.ballMesh.rotation.x += ballVelZ * 2.8;

    // Ball ground shadow position & dynamic scaling with altitude
    this.ballShadow.position.x = this.ballMesh.position.x;
    this.ballShadow.position.z = this.ballMesh.position.z;
    const heightFactor = Math.max(0.2, 1.0 - this.ballMesh.position.y * 0.14);
    this.ballShadow.scale.set(heightFactor, heightFactor, heightFactor);
    (this.ballShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.12, 0.55 - this.ballMesh.position.y * 0.05);

    // 2. Corner Flags Flutter Animation
    this.cornerFlags.forEach((flag, i) => {
      flag.rotation.y = Math.sin(time * 6 + i) * 0.18;
    });

    // 3. Smoothly interpolate players & authentic running cycle animations
    let humanCenterX = 0;
    let humanCenterZ = 0;
    let humanCount = 0;

    for (const visual of this.playersMap.values()) {
      visual.lastPos.copy(visual.group.position);
      visual.group.position.lerp(visual.targetPos, 0.28);

      const moveDist = visual.group.position.distanceTo(visual.lastPos);
      const isMoving = moveDist > 0.02;

      // Facing angle smoothing
      let diff = visual.targetAngle - visual.group.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      visual.group.rotation.y += diff * 0.28;

      // Natural Humanoid Run Cycle: Opposite Arm to Opposite Leg Swing
      if (visual.isTackling) {
        // Sliding tackle posture
        visual.characterGroup.rotation.x = THREE.MathUtils.lerp(visual.characterGroup.rotation.x, Math.PI / 2.7, 0.3);
        visual.leftLeg.rotation.x = 0.9;
        visual.rightLeg.rotation.x = -0.4;
        visual.leftArm.rotation.x = -0.8;
        visual.rightArm.rotation.x = 0.6;
      } else if (visual.isStunned) {
        // Stunned / fouled wobble
        visual.characterGroup.rotation.x = 0;
        visual.characterGroup.rotation.z = Math.sin(time * 16) * 0.3;
        visual.headGroup.rotation.y = Math.sin(time * 12) * 0.4;
        visual.leftLeg.rotation.x = 0;
        visual.rightLeg.rotation.x = 0;
        visual.leftArm.rotation.x = -0.5;
        visual.rightArm.rotation.x = -0.5;
      } else if (isMoving) {
        // High-energy sprint or run cycle
        const animSpeed = visual.isSprinting ? 22 : 14;
        const swingAmp = visual.isSprinting ? 0.85 : 0.65;

        visual.characterGroup.rotation.z = 0;
        visual.characterGroup.rotation.x = 0.16; // Slight forward athletic sprint lean
        visual.characterGroup.position.y = Math.abs(Math.sin(time * animSpeed)) * 0.12;

        // Legs swing
        const legAngle = Math.sin(time * animSpeed) * swingAmp;
        visual.leftLeg.rotation.x = legAngle;
        visual.rightLeg.rotation.x = -legAngle;

        // Arms swing in exact opposition to legs!
        visual.leftArm.rotation.x = -legAngle * 1.1;
        visual.rightArm.rotation.x = legAngle * 1.1;

        // Subtle head turn towards ball
        visual.headGroup.rotation.y = Math.sin(time * 4) * 0.08;
      } else {
        // Idle breathing & gentle balance
        visual.characterGroup.rotation.x = 0;
        visual.characterGroup.rotation.z = 0;
        visual.characterGroup.position.y = Math.sin(time * 3) * 0.035; // Breathing
        visual.headGroup.rotation.y = 0;
        visual.leftLeg.rotation.x = 0;
        visual.rightLeg.rotation.x = 0;
        visual.leftArm.rotation.x = Math.sin(time * 2.5) * 0.05;
        visual.rightArm.rotation.x = -Math.sin(time * 2.5) * 0.05;
      }

      // Human Selection Indicators
      if (visual.isHuman) {
        humanCenterX += visual.group.position.x;
        humanCenterZ += visual.group.position.z;
        humanCount++;

        // Overhead chevron hover
        visual.arrowMesh.position.y = 2.85 + Math.sin(time * 8) * 0.15;

        // Ground ring pulse
        const ringPulse = 1.0 + Math.sin(time * 6) * 0.08;
        visual.selectionRing.scale.set(ringPulse, ringPulse, ringPulse);

        // Name sprite slight float
        if (visual.nameSprite) {
          visual.nameSprite.position.y = 3.6 + Math.sin(time * 4) * 0.07;
        }
      }
    }

    // 4. Dynamic Elevated Broadcast Camera Tracking
    if (humanCount > 0) {
      humanCenterX /= humanCount;
      humanCenterZ /= humanCount;
      this.cameraTarget.set(
        this.ballMesh.position.x * 0.6 + humanCenterX * 0.4,
        0,
        this.ballMesh.position.z * 0.65 + humanCenterZ * 0.35
      );
    } else {
      this.cameraTarget.set(
        this.ballMesh.position.x * 0.75,
        0,
        this.ballMesh.position.z * 0.85
      );
    }

    this.cameraLookAt.lerp(this.cameraTarget, 0.07);

    // Elevated TV Broadcast angle (Mini Football style)
    const camOffset = new THREE.Vector3(0, 34, 30);
    this.camera.position.set(
      this.cameraLookAt.x * 0.82 + camOffset.x,
      camOffset.y,
      this.cameraLookAt.z * 0.82 + camOffset.z
    );
    this.camera.lookAt(this.cameraLookAt.x, 0, this.cameraLookAt.z);

    this.renderer.render(this.scene, this.camera);

    // 5. Render 2D Radar Mini-Map
    this.renderMinimap();
  };

  private renderMinimap() {
    if (!this.minimapCanvas || !this.minimapCtx) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Mini Football stylized pitch background
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, w, h);

    // Perimeter lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(6, 6, w - 12, h - 12);

    // Halfway line & Center circle
    ctx.beginPath();
    ctx.moveTo(6, h / 2);
    ctx.lineTo(w - 6, h / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 14, 0, Math.PI * 2);
    ctx.stroke();

    // Goal boxes
    ctx.strokeRect(w / 2 - 20, 6, 40, 16);
    ctx.strokeRect(w / 2 - 20, h - 22, 40, 16);

    const pitchW = PITCH_CONFIG.width;
    const pitchL = PITCH_CONFIG.length;

    const toMapX = (x: number) => {
      const norm = (x + pitchW / 2) / pitchW;
      return 6 + norm * (w - 12);
    };

    const toMapY = (z: number) => {
      const norm = (z + pitchL / 2) / pitchL;
      return 6 + norm * (h - 12);
    };

    // Draw players
    for (const visual of this.playersMap.values()) {
      const px = toMapX(visual.group.position.x);
      const py = toMapY(visual.group.position.z);
      const isBlue = visual.group.position.z < 0 || visual.targetAngle > 0;

      // Human glowing ring
      if (visual.isHuman) {
        ctx.strokeStyle = visual.humanColorCss || '#00e5ff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(px, py, 6.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = isBlue ? '#3b82f6' : '#ef4444';
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw ball
    const bx = toMapX(this.ballMesh.position.x);
    const by = toMapY(this.ballMesh.position.z);

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public dispose() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}

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

interface PlayerVisual {
  group: THREE.Group;
  characterGroup: THREE.Group;
  torsoMesh: THREE.Mesh;
  headMesh: THREE.Mesh;
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

  // Camera tracking
  private cameraTarget = new THREE.Vector3(0, 0, 0);
  private cameraLookAt = new THREE.Vector3(0, 0, 0);

  // Cached materials
  private blueMat: THREE.MeshStandardMaterial;
  private redMat: THREE.MeshStandardMaterial;
  private blueGkMat: THREE.MeshStandardMaterial;
  private redGkMat: THREE.MeshStandardMaterial;

  constructor(container: HTMLElement, minimapCanvas?: HTMLCanvasElement) {
    this.container = container;
    this.minimapCanvas = minimapCanvas;
    if (minimapCanvas) {
      this.minimapCtx = minimapCanvas.getContext('2d');
    }

    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0a1120');
    this.scene.fog = new THREE.FogExp2('#0a1120', 0.008);

    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.5, 1000);
    this.camera.position.set(0, 34, 28); // Isometric elevated broadcast view

    // 2. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // 3. Materials
    this.blueMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35, metalness: 0.1 });
    this.redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.1 });
    this.blueGkMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
    this.redGkMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3 });

    // 4. Stadium Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight1.position.set(30, 55, 25);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    dirLight1.shadow.camera.near = 10;
    dirLight1.shadow.camera.far = 120;
    dirLight1.shadow.camera.left = -40;
    dirLight1.shadow.camera.right = 40;
    dirLight1.shadow.camera.top = 40;
    dirLight1.shadow.camera.bottom = -40;
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x93c5fd, 0.5);
    dirLight2.position.set(-30, 40, -25);
    this.scene.add(dirLight2);

    // 5. Build Stadium, Pitch, Goals & Floodlights
    this.buildPitch();
    this.buildGoals();
    this.buildStadiumSurround();

    // 6. Ball
    const ballGeo = new THREE.SphereGeometry(PITCH_CONFIG.ballRadius, 24, 24);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.25, metalness: 0.05 });
    this.ballMesh = new THREE.Mesh(ballGeo, ballMat);
    this.ballMesh.castShadow = true;
    this.ballMesh.position.set(0, PITCH_CONFIG.ballRadius, 0);
    this.scene.add(this.ballMesh);

    // Ball Ground Shadow (dynamic height scaling)
    const shadowGeo = new THREE.CircleGeometry(PITCH_CONFIG.ballRadius * 1.1, 20);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });
    this.ballShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.y = 0.02;
    this.scene.add(this.ballShadow);

    // 7. Resize listener
    window.addEventListener('resize', this.onResize);

    // 8. Start loop
    this.renderLoop();
  }

  private buildPitch() {
    const width = PITCH_CONFIG.width;
    const length = PITCH_CONFIG.length;

    // Outer turf border (stadium floor)
    const apronGeo = new THREE.PlaneGeometry(width + 18, length + 22);
    const apronMat = new THREE.MeshStandardMaterial({ color: 0x0f2d1e, roughness: 0.95 });
    const apron = new THREE.Mesh(apronGeo, apronMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.05;
    apron.receiveShadow = true;
    this.scene.add(apron);

    // High quality procedural striped grass texture
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d')!;

    const stripes = 16;
    const stripeH = canvas.height / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#278046' : '#22723d';
      ctx.fillRect(0, i * stripeH, canvas.width, stripeH);
    }

    // Pitch Line markings on canvas
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;

    // Perimeter touchlines
    const padX = 35;
    const padY = 35;
    const pW = canvas.width - padX * 2;
    const pH = canvas.height - padY * 2;
    ctx.strokeRect(padX, padY, pW, pH);

    // Halfway line
    ctx.beginPath();
    ctx.moveTo(padX, canvas.height / 2);
    ctx.lineTo(canvas.width - padX, canvas.height / 2);
    ctx.stroke();

    // Center circle
    const centerRadius = (pH * 9) / length;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, centerRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Center spot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 12, 0, Math.PI * 2);
    ctx.fill();

    // Penalty areas (North and South)
    const penW = (pW * PITCH_CONFIG.penaltyWidth) / width;
    const penH = (pH * PITCH_CONFIG.penaltyLength) / length;

    // Blue goal penalty box (North / top)
    ctx.strokeRect(canvas.width / 2 - penW / 2, padY, penW, penH);
    // Red goal penalty box (South / bottom)
    ctx.strokeRect(canvas.width / 2 - penW / 2, padY + pH - penH, penW, penH);

    // Goal area small boxes
    const goalBoxW = penW * 0.55;
    const goalBoxH = penH * 0.45;
    ctx.strokeRect(canvas.width / 2 - goalBoxW / 2, padY, goalBoxW, goalBoxH);
    ctx.strokeRect(canvas.width / 2 - goalBoxW / 2, padY + pH - goalBoxH, goalBoxW, goalBoxH);

    // Corner arcs
    const cornerR = 25;
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
      roughness: 0.75,
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
    const postRadius = 0.14;

    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.3 });
    const netMat = new THREE.MeshBasicMaterial({
      color: 0xdddddd,
      wireframe: true,
      transparent: true,
      opacity: 0.45
    });

    // Create Goal at each end (dir = -1 for Blue, +1 for Red)
    [-1, 1].forEach((dir) => {
      const goalGroup = new THREE.Group();
      const zPos = halfLength * dir;

      // Left post
      const postGeo = new THREE.CylinderGeometry(postRadius, postRadius, height, 16);
      const leftPost = new THREE.Mesh(postGeo, postMat);
      leftPost.position.set(-halfWidth, height / 2, 0);
      leftPost.castShadow = true;
      goalGroup.add(leftPost);

      // Right post
      const rightPost = new THREE.Mesh(postGeo, postMat);
      rightPost.position.set(halfWidth, height / 2, 0);
      rightPost.castShadow = true;
      goalGroup.add(rightPost);

      // Crossbar
      const barGeo = new THREE.CylinderGeometry(postRadius, postRadius, PITCH_CONFIG.goalWidth, 16);
      const crossbar = new THREE.Mesh(barGeo, postMat);
      crossbar.rotation.z = Math.PI / 2;
      crossbar.position.set(0, height, 0);
      crossbar.castShadow = true;
      goalGroup.add(crossbar);

      // Net box
      const netGeo = new THREE.BoxGeometry(PITCH_CONFIG.goalWidth, height, depth);
      const netMesh = new THREE.Mesh(netGeo, netMat);
      netMesh.position.set(0, height / 2, (depth / 2) * dir);
      goalGroup.add(netMesh);

      goalGroup.position.set(0, 0, zPos);
      this.scene.add(goalGroup);
    });
  }

  private buildStadiumSurround() {
    const width = PITCH_CONFIG.width;
    const length = PITCH_CONFIG.length;

    // Advertising boards texture
    const adCanvas = document.createElement('canvas');
    adCanvas.width = 1024;
    adCanvas.height = 128;
    const adCtx = adCanvas.getContext('2d')!;
    adCtx.fillStyle = '#0f172a';
    adCtx.fillRect(0, 0, adCanvas.width, adCanvas.height);

    adCtx.font = 'bold 36px Segoe UI, sans-serif';
    adCtx.fillStyle = '#38bdf8';
    adCtx.fillText('★ PARTY PLATFORM', 40, 75);
    adCtx.fillStyle = '#facc15';
    adCtx.fillText('⚽ MINI FOOTBALL 5v5', 420, 75);
    adCtx.fillStyle = '#4ade80';
    adCtx.fillText('⚡ RETRO ARCADE', 820, 75);

    const adTexture = new THREE.CanvasTexture(adCanvas);
    adTexture.wrapS = THREE.RepeatWrapping;
    adTexture.repeat.set(3, 1);

    const adMat = new THREE.MeshStandardMaterial({
      map: adTexture,
      roughness: 0.4,
      metalness: 0.2
    });

    const boardH = 1.0;
    const boardGeoX = new THREE.BoxGeometry(0.3, boardH, length + 2);
    const boardGeoZ = new THREE.BoxGeometry(width + 4, boardH, 0.3);

    // Left & Right boards
    const leftBoard = new THREE.Mesh(boardGeoX, adMat);
    leftBoard.position.set(-width / 2 - 2, boardH / 2, 0);
    this.scene.add(leftBoard);

    const rightBoard = new THREE.Mesh(boardGeoX, adMat);
    rightBoard.position.set(width / 2 + 2, boardH / 2, 0);
    this.scene.add(rightBoard);

    // Behind goals boards (with gap for goal)
    [-1, 1].forEach((dir) => {
      const zPos = (length / 2 + 3.5) * dir;
      const board = new THREE.Mesh(boardGeoZ, adMat);
      board.position.set(0, boardH / 2, zPos);
      this.scene.add(board);
    });

    // 4 Corner Floodlight Towers
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    [
      [-width / 2 - 6, -length / 2 - 8],
      [width / 2 + 6, -length / 2 - 8],
      [-width / 2 - 6, length / 2 + 8],
      [width / 2 + 6, length / 2 + 8]
    ].forEach(([tx, tz]) => {
      const towerGroup = new THREE.Group();
      towerGroup.position.set(tx, 0, tz);

      // Mast
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 22, 8), towerMat);
      mast.position.y = 11;
      towerGroup.add(mast);

      // Light Panel
      const panel = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 0.8), towerMat);
      panel.position.set(0, 21.5, 0);
      panel.lookAt(0, 0, 0);
      towerGroup.add(panel);

      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.4), lampMat);
      lamp.position.set(0, 21.5, 0.45);
      lamp.lookAt(0, 0, 0);
      towerGroup.add(lamp);

      this.scene.add(towerGroup);
    });
  }

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

      // Human assignment: assign distinct neon color
      if (visual.isHuman) {
        let colorIdx = this.sessionColorMap.get(player.controlledBySessionId);
        if (colorIdx === undefined) {
          colorIdx = this.sessionColorMap.size % HUMAN_PLAYER_COLORS.length;
          this.sessionColorMap.set(player.controlledBySessionId, colorIdx);
        }
        const assignedColor = HUMAN_PLAYER_COLORS[colorIdx];
        visual.humanColorHex = assignedColor.hex;
        visual.humanColorCss = assignedColor.css;

        // Apply color to overhead arrow & selection ring
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

  private createPlayerVisual(player: FootballPlayerEntityType): PlayerVisual {
    const group = new THREE.Group();
    const characterGroup = new THREE.Group();
    group.add(characterGroup);

    const isGk = player.isGoalkeeper;
    const bodyMat = isGk
      ? player.team === 'blue'
        ? this.blueGkMat
        : this.redGkMat
      : player.team === 'blue'
      ? this.blueMat
      : this.redMat;

    // 1. Ground Shadow (disc beneath feet)
    const shadowGeo = new THREE.CircleGeometry(PITCH_CONFIG.playerRadius * 0.9, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    const groundShadow = new THREE.Mesh(shadowGeo, shadowMat);
    groundShadow.rotation.x = -Math.PI / 2;
    groundShadow.position.y = 0.02;
    group.add(groundShadow);

    // 2. Selection Ring (Human indicator at feet)
    const ringGeo = new THREE.RingGeometry(0.55, 0.72, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });
    const selectionRing = new THREE.Mesh(ringGeo, ringMat);
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.03;
    selectionRing.visible = false;
    group.add(selectionRing);

    // 3. Torso / Jersey
    const torsoGeo = new THREE.CapsuleGeometry(0.34, 0.65, 8, 16);
    const torsoMesh = new THREE.Mesh(torsoGeo, bodyMat);
    torsoMesh.position.y = 1.05;
    torsoMesh.castShadow = true;
    characterGroup.add(torsoMesh);

    // 4. Shorts
    const shortsMat = new THREE.MeshStandardMaterial({
      color: player.team === 'blue' ? 0x0f172a : 0xffffff,
      roughness: 0.5
    });
    const shortsGeo = new THREE.BoxGeometry(0.56, 0.28, 0.36);
    const shortsMesh = new THREE.Mesh(shortsGeo, shortsMat);
    shortsMesh.position.y = 0.68;
    shortsMesh.castShadow = true;
    characterGroup.add(shortsMesh);

    // 5. Legs & Boots (Left & Right)
    const sockMat = bodyMat;
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.3 });

    const createLeg = (xOffset: number) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(xOffset, 0.55, 0);

      const legGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.42, 8);
      const legMesh = new THREE.Mesh(legGeo, sockMat);
      legMesh.position.y = -0.21;
      legMesh.castShadow = true;
      legGroup.add(legMesh);

      const bootGeo = new THREE.BoxGeometry(0.12, 0.1, 0.24);
      const bootMesh = new THREE.Mesh(bootGeo, bootMat);
      bootMesh.position.set(0, -0.42, 0.05);
      bootMesh.castShadow = true;
      legGroup.add(bootMesh);

      return legGroup;
    };

    const leftLeg = createLeg(-0.16);
    const rightLeg = createLeg(0.16);
    characterGroup.add(leftLeg);
    characterGroup.add(rightLeg);

    // 6. Head & Hair
    const headGeo = new THREE.SphereGeometry(0.28, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xd99b72, roughness: 0.5 });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.y = 1.72;
    headMesh.castShadow = true;
    characterGroup.add(headMesh);

    const hairGeo = new THREE.SphereGeometry(0.29, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2.2);
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x26170d, roughness: 0.8 });
    const hairMesh = new THREE.Mesh(hairGeo, hairMat);
    hairMesh.position.y = 1.74;
    characterGroup.add(hairMesh);

    // 7. Overhead Triangular Arrow for Human (`▲`)
    const arrowGeo = new THREE.ConeGeometry(0.35, 0.6, 4);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
    arrowMesh.rotation.x = Math.PI; // point downwards towards player
    arrowMesh.position.y = 2.5;
    arrowMesh.visible = false;
    group.add(arrowMesh);

    this.scene.add(group);

    return {
      group,
      characterGroup,
      torsoMesh,
      headMesh,
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
    canvas.width = 320;
    canvas.height = 80;
    const ctx = canvas.getContext('2d')!;

    // Pill background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 80);
    bgGrad.addColorStop(0, team === 'blue' ? 'rgba(30, 58, 138, 0.92)' : 'rgba(153, 27, 27, 0.92)');
    bgGrad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');

    ctx.fillStyle = bgGrad;
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(10, 8, 300, 64, 18);
    } else {
      ctx.rect(10, 8, 300, 64);
    }
    ctx.fill();

    // Vibrant accent border with player's custom neon color
    ctx.strokeStyle = accentColorCss || '#00e5ff';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Text: ★ Nickname (#Number)
    ctx.font = '900 28px Segoe UI, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const numStr = number ? ` (#${number})` : '';
    const label = `★ ${name}${numStr}`;
    ctx.fillText(label, 160, 40);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3.6, 0.9, 1);
    sprite.position.y = 3.3;

    return sprite;
  }

  private renderLoop = () => {
    this.animFrameId = requestAnimationFrame(this.renderLoop);

    const time = Date.now() * 0.001;

    // 1. Smoothly interpolate ball position & spin
    this.ballLastPos.copy(this.ballMesh.position);
    this.ballMesh.position.lerp(this.ballTargetPos, 0.35);

    const ballVelX = this.ballMesh.position.x - this.ballLastPos.x;
    const ballVelZ = this.ballMesh.position.z - this.ballLastPos.z;
    this.ballMesh.rotation.z -= ballVelX * 2.5;
    this.ballMesh.rotation.x += ballVelZ * 2.5;

    // Ball ground shadow position and scaling with height
    this.ballShadow.position.x = this.ballMesh.position.x;
    this.ballShadow.position.z = this.ballMesh.position.z;
    const heightFactor = Math.max(0.2, 1.0 - this.ballMesh.position.y * 0.15);
    this.ballShadow.scale.set(heightFactor, heightFactor, heightFactor);
    (this.ballShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.15, 0.5 - this.ballMesh.position.y * 0.05);

    // 2. Smoothly interpolate players & animate
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

      // Procedural running / movement animation
      if (visual.isTackling) {
        visual.characterGroup.rotation.x = THREE.MathUtils.lerp(visual.characterGroup.rotation.x, Math.PI / 3, 0.3);
        visual.leftLeg.rotation.x = 0.8;
        visual.rightLeg.rotation.x = -0.4;
      } else if (visual.isStunned) {
        visual.characterGroup.rotation.x = 0;
        visual.characterGroup.rotation.z = Math.sin(time * 16) * 0.25;
        visual.leftLeg.rotation.x = 0;
        visual.rightLeg.rotation.x = 0;
      } else if (isMoving) {
        const animSpeed = visual.isSprinting ? 22 : 14;
        visual.characterGroup.rotation.z = 0;
        visual.characterGroup.rotation.x = 0.14; // slight forward run lean
        visual.characterGroup.position.y = Math.abs(Math.sin(time * animSpeed)) * 0.1;
        visual.leftLeg.rotation.x = Math.sin(time * animSpeed) * 0.65;
        visual.rightLeg.rotation.x = -Math.sin(time * animSpeed) * 0.65;
      } else {
        visual.characterGroup.rotation.x = 0;
        visual.characterGroup.rotation.z = 0;
        visual.characterGroup.position.y = Math.sin(time * 3) * 0.03; // breathing
        visual.leftLeg.rotation.x = 0;
        visual.rightLeg.rotation.x = 0;
      }

      // Human selection indicators
      if (visual.isHuman) {
        humanCenterX += visual.group.position.x;
        humanCenterZ += visual.group.position.z;
        humanCount++;

        // Overhead arrow hover animation
        visual.arrowMesh.position.y = 2.5 + Math.sin(time * 8) * 0.15;

        // Ground ring pulse
        const ringPulse = 1.0 + Math.sin(time * 6) * 0.08;
        visual.selectionRing.scale.set(ringPulse, ringPulse, ringPulse);

        // Name sprite slight float
        if (visual.nameSprite) {
          visual.nameSprite.position.y = 3.3 + Math.sin(time * 4) * 0.06;
        }
      }
    }

    // 3. Dynamic broadcast camera tracking (Retro Goal inspiration)
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

    // Dynamic zoom based on action spread
    const camOffset = new THREE.Vector3(0, 32, 26);
    this.camera.position.set(
      this.cameraLookAt.x * 0.85 + camOffset.x,
      camOffset.y,
      this.cameraLookAt.z * 0.85 + camOffset.z
    );
    this.camera.lookAt(this.cameraLookAt.x, 0, this.cameraLookAt.z);

    this.renderer.render(this.scene, this.camera);

    // 4. Render 2D Radar Mini-Map
    this.renderMinimap();
  };

  private renderMinimap() {
    if (!this.minimapCanvas || !this.minimapCtx) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Field background
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, 0, w, h);

    // Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(6, 6, w - 12, h - 12);

    // Center line
    ctx.beginPath();
    ctx.moveTo(6, h / 2);
    ctx.lineTo(w - 6, h / 2);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 14, 0, Math.PI * 2);
    ctx.stroke();

    // Goals boxes
    ctx.strokeRect(w / 2 - 20, 6, 40, 16);
    ctx.strokeRect(w / 2 - 20, h - 22, 40, 16);

    // World to minimap coord helper
    // World: x is [-width/2, +width/2], z is [-length/2, +length/2]
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
      const isBlue = visual.group.children[0]?.children?.some((c: any) => c.material === this.blueMat || c.material === this.blueGkMat);

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

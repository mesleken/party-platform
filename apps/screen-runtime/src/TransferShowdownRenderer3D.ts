import * as THREE from 'three';
import type {
  MatchHighlight,
  ShowdownSnapshot
} from '@games/transfer-showdown';

export class TransferShowdownRenderer3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animFrameId?: number;

  // 3D Pitch & Stadium
  private pitchMesh!: THREE.Mesh;
  private ballMesh!: THREE.Mesh;
  private ballShadow!: THREE.Mesh;

  // Chibi Players
  private homePlayers: THREE.Group[] = [];
  private awayPlayers: THREE.Group[] = [];
  private homeGkGroup!: THREE.Group;
  private awayGkGroup!: THREE.Group;

  // Animation & Highlight State
  private currentSnapshot: ShowdownSnapshot | null = null;
  private activeHighlightId = '';
  private highlightTimer = 0;
  private cameraTargetPos = new THREE.Vector3(0, 22, 28);
  private cameraLookAtPos = new THREE.Vector3(0, 0, 0);

  // Ball Trajectory Interpolation
  private ballStart = new THREE.Vector3(0, 0.4, 0);
  private ballEnd = new THREE.Vector3(0, 0.4, 0);
  private ballApex = 0.4;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene & Atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#070d18');
    this.scene.fog = new THREE.FogExp2('#070d18', 0.008);

    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.5, 1000);
    this.camera.position.set(0, 26, 32);

    // 2. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // 3. Lighting
    this.setupLighting();

    // 4. Stadium, Pitch & Goals
    this.setupPitchAndStadium();

    // 5. Ball & Players
    this.setupBall();
    this.setupChibiSquads();

    // 6. Window Resize
    window.addEventListener('resize', this.onResize);

    // 7. Render Loop
    this.render = this.render.bind(this);
    this.render();
  }

  private setupLighting() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);

    // 4 Köşe Stadyum projektörleri
    const corners = [
      { x: -35, z: -25 },
      { x: 35, z: -25 },
      { x: -35, z: 25 },
      { x: 35, z: 25 }
    ];

    corners.forEach((c) => {
      const spot = new THREE.SpotLight(0xfff5ea, 1.2, 120, Math.PI / 4, 0.4, 1.5);
      spot.position.set(c.x, 28, c.z);
      spot.target.position.set(0, 0, 0);
      spot.castShadow = true;
      spot.shadow.mapSize.width = 1024;
      spot.shadow.mapSize.height = 1024;
      spot.shadow.bias = -0.001;
      this.scene.add(spot);
      this.scene.add(spot.target);
    });
  }

  private setupPitchAndStadium() {
    // Çim Dokusu (Striped Pitch)
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1e5128';
    ctx.fillRect(0, 0, 1024, 1024);

    const stripeWidth = 1024 / 16;
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#236030' : '#1e5128';
      ctx.fillRect(i * stripeWidth, 0, stripeWidth, 1024);
    }

    // Saha Çizgileri
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;

    // Dış Saha Çerçevesi
    ctx.strokeRect(40, 40, 944, 944);

    // Orta Çizgi & Orta Daire
    ctx.beginPath();
    ctx.moveTo(512, 40);
    ctx.lineTo(512, 984);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(512, 512, 120, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(512, 512, 12, 0, Math.PI * 2);
    ctx.fill();

    // Sol Ceza Sahası
    ctx.strokeRect(40, 312, 200, 400);
    ctx.strokeRect(40, 412, 80, 200);

    // Sağ Ceza Sahası
    ctx.strokeRect(784, 312, 200, 400);
    ctx.strokeRect(904, 412, 80, 200);

    const pitchTex = new THREE.CanvasTexture(canvas);
    pitchTex.wrapS = THREE.ClampToEdgeWrapping;
    pitchTex.wrapT = THREE.ClampToEdgeWrapping;

    const pitchGeo = new THREE.PlaneGeometry(64, 40);
    const pitchMat = new THREE.MeshStandardMaterial({
      map: pitchTex,
      roughness: 0.85,
      metalness: 0.05
    });

    this.pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
    this.pitchMesh.rotation.x = -Math.PI / 2;
    this.pitchMesh.receiveShadow = true;
    this.scene.add(this.pitchMesh);

    // Saha Etrafı LED Reklam Panoları & Tribün
    this.setupSurroundings();

    // Kaleler
    this.setupGoal(true);
    this.setupGoal(false);
  }

  private setupSurroundings() {
    // LED Reklam Panosu
    const boardMat = new THREE.MeshBasicMaterial({ color: '#0284c7' });
    const boardGeoX = new THREE.BoxGeometry(66, 1.2, 0.4);
    const topBoard = new THREE.Mesh(boardGeoX, boardMat);
    topBoard.position.set(0, 0.6, -20.5);
    this.scene.add(topBoard);

    const btmBoard = new THREE.Mesh(boardGeoX, boardMat);
    btmBoard.position.set(0, 0.6, 20.5);
    this.scene.add(btmBoard);
  }

  private setupGoal(isLeft: boolean) {
    const postMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2, metalness: 0.4 });
    const netMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      wireframe: true,
      transparent: true,
      opacity: 0.4
    });

    const goalGroup = new THREE.Group();
    const xPos = isLeft ? -30 : 30;
    const rotY = isLeft ? Math.PI / 2 : -Math.PI / 2;

    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7.3, 16), postMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, 2.5, 0);

    const postLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.5, 16), postMat);
    postLeft.position.set(-3.65, 1.25, 0);

    const postRight = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.5, 16), postMat);
    postRight.position.set(3.65, 1.25, 0);

    const netGeo = new THREE.BoxGeometry(7.3, 2.5, 2.5);
    const net = new THREE.Mesh(netGeo, netMat);
    net.position.set(0, 1.25, -1.25);

    goalGroup.add(crossbar, postLeft, postRight, net);
    goalGroup.position.set(xPos, 0, 0);
    goalGroup.rotation.y = rotY;

    this.scene.add(goalGroup);
  }

  private setupBall() {
    // Telstar Futbol Topu
    const ballGeo = new THREE.SphereGeometry(0.42, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.3,
      metalness: 0.1
    });

    this.ballMesh = new THREE.Mesh(ballGeo, ballMat);
    this.ballMesh.castShadow = true;
    this.ballMesh.position.set(0, 0.42, 0);
    this.scene.add(this.ballMesh);

    // Top Gölgesi
    const shadowGeo = new THREE.CircleGeometry(0.45, 16);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
    this.ballShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.set(0, 0.02, 0);
    this.scene.add(this.ballShadow);
  }

  private setupChibiSquads() {
    // Ev Sahibi (Mavi) ve Deplasman (Kırmızı) 5'er temsili chibi oyuncu
    const homeColor = '#2563eb';
    const awayColor = '#dc2626';

    for (let i = 0; i < 5; i++) {
      const p = this.createChibiPlayer(homeColor, i === 0 ? 'GK' : 'OUTFIELD');
      this.homePlayers.push(p);
      this.scene.add(p);
    }
    for (let i = 0; i < 5; i++) {
      const p = this.createChibiPlayer(awayColor, i === 0 ? 'GK' : 'OUTFIELD');
      this.awayPlayers.push(p);
      this.scene.add(p);
    }

    this.homeGkGroup = this.homePlayers[0];
    this.awayGkGroup = this.awayPlayers[0];

    this.resetPlayersToKickoff();
  }

  private createChibiPlayer(jerseyColor: string, role: 'GK' | 'OUTFIELD'): THREE.Group {
    const group = new THREE.Group();

    // Bobblehead Kafa (Büyük Chibi Stili)
    const headMat = new THREE.MeshStandardMaterial({ color: '#f5d0b5', roughness: 0.6 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.65, 20, 20), headMat);
    head.position.y = 1.7;
    head.castShadow = true;

    // Saç
    const hairMat = new THREE.MeshStandardMaterial({ color: '#171717', roughness: 0.8 });
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.68, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), hairMat);
    hair.position.y = 1.78;

    // Gövde (Forma)
    const actualJersey = role === 'GK' ? '#10b981' : jerseyColor;
    const bodyMat = new THREE.MeshStandardMaterial({ color: actualJersey, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.8, 16), bodyMat);
    body.position.y = 0.95;
    body.castShadow = true;

    // Bacaklar & Ayakkabılar
    const legMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), legMat);
    leftLeg.position.set(-0.2, 0.35, 0);

    const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), legMat);
    rightLeg.position.set(0.2, 0.35, 0);

    // Yer Gölgesi
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 });
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 16), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;

    group.add(head, hair, body, leftLeg, rightLeg, shadow);
    return group;
  }

  private resetPlayersToKickoff() {
    // Ev Sahibi Pozisyonları (Solda)
    this.homePlayers[0].position.set(-28, 0, 0); // GK
    this.homePlayers[1].position.set(-18, 0, -8); // DEF
    this.homePlayers[2].position.set(-18, 0, 8); // DEF
    this.homePlayers[3].position.set(-8, 0, 0); // MID
    this.homePlayers[4].position.set(-2, 0, 2); // FWD

    // Deplasman Pozisyonları (Sağda)
    this.awayPlayers[0].position.set(28, 0, 0); // GK
    this.awayPlayers[1].position.set(18, 0, -8); // DEF
    this.awayPlayers[2].position.set(18, 0, 8); // DEF
    this.awayPlayers[3].position.set(8, 0, 0); // MID
    this.awayPlayers[4].position.set(2, 0, -2); // FWD

    this.ballMesh.position.set(0, 0.42, 0);
    this.ballShadow.position.set(0, 0.02, 0);
  }

  public updateSnapshot(snapshot: ShowdownSnapshot) {
    this.currentSnapshot = snapshot;

    // Maç Highlight Animasyon Kontrolü
    if (snapshot.currentHighlight && snapshot.currentHighlight.id !== this.activeHighlightId) {
      this.activeHighlightId = snapshot.currentHighlight.id;
      this.startHighlightAnimation(snapshot.currentHighlight);
    }
  }

  private startHighlightAnimation(hl: MatchHighlight) {
    this.highlightTimer = 0;

    const isHome = hl.attackingTeam === 0;
    const attTeam = isHome ? this.homePlayers : this.awayPlayers;
    const defGk = isHome ? this.awayGkGroup : this.homeGkGroup;
    const targetGoalX = isHome ? 30 : -30;

    // Hücum oyuncularını ceza sahası yakınına konumlandır
    const striker = attTeam[4];
    const playmaker = attTeam[3];

    const startX = isHome ? 5 : -5;
    const finishX = isHome ? 22 : -22;

    striker.position.set(finishX, 0, (Math.random() - 0.5) * 8);
    playmaker.position.set(startX, 0, (Math.random() - 0.5) * 12);
    defGk.position.set(targetGoalX + (isHome ? -2 : 2), 0, 0);

    // Topun kalkış ve hedef noktası
    this.ballStart.copy(playmaker.position).setY(0.42);
    this.ballApex = hl.type === 'GOAL' ? 2.5 : 1.2;

    if (hl.type === 'GOAL') {
      const topCornerY = 1.6 + Math.random() * 0.7;
      const cornerZ = (Math.random() > 0.5 ? 1 : -1) * (2.0 + Math.random() * 1.2);
      this.ballEnd.set(targetGoalX, topCornerY, cornerZ);
    } else if (hl.type === 'SAVE') {
      const saveZ = (Math.random() - 0.5) * 4;
      this.ballEnd.set(targetGoalX + (isHome ? -1.5 : 1.5), 1.2, saveZ);
    } else if (hl.type === 'WOODWORK') {
      this.ballEnd.set(targetGoalX, 2.6, (Math.random() - 0.5) * 3);
    } else {
      this.ballEnd.set(targetGoalX, 0.42, (Math.random() > 0.5 ? 4.5 : -4.5));
    }

    // Kamera Takibi
    const camX = isHome ? 12 : -12;
    this.cameraTargetPos.set(camX, 16, 22);
    this.cameraLookAtPos.set(targetGoalX * 0.7, 1.5, 0);
  }

  private render() {
    this.animFrameId = requestAnimationFrame(this.render);

    const delta = 0.016;
    this.highlightTimer += delta;

    // Kamera Yumuşak Takibi (Lerp)
    this.camera.position.lerp(this.cameraTargetPos, 0.05);
    const curLook = new THREE.Vector3(0, 0, 0);
    this.camera.getWorldDirection(curLook);
    this.camera.lookAt(this.cameraLookAtPos);

    // Topun Uçuşu ve Hareketi
    if (this.currentSnapshot?.phase === 'MATCH_FIRST_HALF' || this.currentSnapshot?.phase === 'MATCH_SECOND_HALF') {
      const progress = Math.min(1, this.highlightTimer / 3.0);
      const easeP = Math.sin((progress * Math.PI) / 2);

      this.ballMesh.position.x = THREE.MathUtils.lerp(this.ballStart.x, this.ballEnd.x, easeP);
      this.ballMesh.position.z = THREE.MathUtils.lerp(this.ballStart.z, this.ballEnd.z, easeP);
      this.ballMesh.position.y = Math.max(0.42, Math.sin(easeP * Math.PI) * this.ballApex + THREE.MathUtils.lerp(0.42, this.ballEnd.y, easeP));

      this.ballShadow.position.x = this.ballMesh.position.x;
      this.ballShadow.position.z = this.ballMesh.position.z;
      const shadowScale = Math.max(0.2, 1 - (this.ballMesh.position.y - 0.42) * 0.3);
      this.ballShadow.scale.set(shadowScale, shadowScale, 1);

      // Oyuncuların Canlı Salınımı (Bobbing / Run Cycle)
      const bob = Math.sin(this.highlightTimer * 10) * 0.08;
      this.homePlayers.forEach((p, idx) => {
        p.position.y = Math.abs(bob);
        p.rotation.y = idx === 0 ? 0 : Math.PI / 2;
      });
      this.awayPlayers.forEach((p, idx) => {
        p.position.y = Math.abs(bob);
        p.rotation.y = idx === 0 ? 0 : -Math.PI / 2;
      });
    } else if (this.currentSnapshot?.phase === 'AUCTION') {
      // Açık artırmada stadyum etrafında yavaş dönen sinematik kamera
      const time = Date.now() * 0.0003;
      this.cameraTargetPos.set(Math.cos(time) * 35, 22, Math.sin(time) * 35);
      this.cameraLookAtPos.set(0, 2, 0);
    }

    this.renderer.render(this.scene, this.camera);
  }

  private onResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public destroy() {
    window.removeEventListener('resize', this.onResize);
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.renderer.dispose();
  }
}

import * as THREE from 'three';
import type { RcRushSnapshot, CarSnapshot, RaceEvent } from '@games/rc-rush';
import { TRACK_WAYPOINTS, TRACK_CONFIG, TRACK_DECORATIONS } from '@games/rc-rush';

interface CarInterpolationTarget {
  x: number;
  y: number;
  z: number;
  rotation: number;
  roll: number;
  speed: number;
  prevSpeed: number;
  wheelSteer: number;
  wheelRotation: number;
  isBoosting: boolean;
  isDrifting: boolean;
  slipRatio: number;
}

interface AntennaPhysicsState {
  mastLine: THREE.Line;
  tipMesh: THREE.Mesh;
  tipLocalX: number;
  tipLocalZ: number;
  velX: number;
  velZ: number;
}

export class RcRushRenderer3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animFrameId?: number;

  private carMeshes: Map<string, THREE.Group> = new Map();
  private bodyShells: Map<string, THREE.Group> = new Map();
  private wheelMeshes: Map<string, THREE.Mesh[]> = new Map();
  private antennaStates: Map<string, AntennaPhysicsState> = new Map();
  private carHeadlights: Map<string, THREE.SpotLight[]> = new Map();
  private carTaillights: Map<string, THREE.Mesh[]> = new Map();
  private nameSprites: Map<string, THREE.Sprite> = new Map();
  private interpolationTargets: Map<string, CarInterpolationTarget> = new Map();

  private pickupMeshes: Map<string, THREE.Group> = new Map();
  private projectileMeshes: Map<string, THREE.Group> = new Map();

  // Start / Finish Gantry Işıkları
  private gantryLights: THREE.Mesh[] = [];

  // Re-Volt Ring-Buffer Skidmark System (Lastik İzi)
  private skidMesh!: THREE.Mesh;
  private skidPositions!: Float32Array;
  private maxSkidQuads = 500;
  private skidQuadIndex = 0;
  private lastTirePoints: Map<string, { left: THREE.Vector3; right: THREE.Vector3 }> = new Map();

  // Parçacık Sistemi (Egzoz, Nitro Alevi, Çarpışma Kıvılcımları)
  private particles!: THREE.Points;
  private particlePositions!: Float32Array;
  private particleVelocities!: Float32Array;
  private particleLifetimes!: Float32Array;
  private particleColors!: Float32Array;
  private maxParticles = 750;

  // Ortam Toz Zerrecikleri (Retro Macro Ambient Dust)
  private dustParticles!: THREE.Points;
  private maxDust = 120;

  private latestSnapshot: RcRushSnapshot | null = null;
  private cameraShakeIntensity = 0;
  private targetCameraFov = 62;
  private focusedCarId: string | null = null;

  public getSnapshot(): RcRushSnapshot | null {
    return this.latestSnapshot;
  }

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Sahne & Sis (Retro 90s Vintage Atmosfer)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e17);
    this.scene.fog = new THREE.FogExp2(0x0a0e17, 0.0055);

    const aspect = container.clientWidth / container.clientHeight || 16 / 9;
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.3, 700);
    this.camera.position.set(0, 26, -65);
    this.camera.lookAt(0, 0, -35);

    // 2. WebGL Renderer (High-Fi PC / Dreamcast Arcade Look)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // 3. Işıklar (Retro Sıcak Oda Işığı + Dinamik Spotlar)
    this.setupLighting();

    // 4. Çevre (Devasa 90'lar Çocuk Odası / Atölye, Süpürgelik, Duvar Prizi, Ahşap Masa Ayakları)
    this.buildRoomEnvironment();

    // 5. Pist (Gerçekçi Asfalt Dokusu, Re-Volt Eğik Bordürler, Start/Finish Kemeri)
    this.buildTrack();

    // 6. Lastik İzi (Skidmarks) Sistemi
    this.initSkidmarks();

    // 7. Devasa Re-Volt Makro Engelleri (Kola Kutuları, Piller, Kupa, Kitaplar, İngiliz Anahtarı, Dominolar)
    this.buildDecorations();

    // 8. Parçacık Sistemleri
    this.setupParticles();
    this.setupAmbientDust();

    // 9. Resize Listener
    window.addEventListener('resize', this.onResize);

    // 10. 60+ FPS Kesintisiz Döngü
    this.startLoop();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. AYDINLATMA & RETRO ATMOSFER (90s WARM LIGHTING)
  // ═══════════════════════════════════════════════════════════════════════════
  private setupLighting() {
    // Sıcak Ortam Işığı
    const ambient = new THREE.AmbientLight(0xffedd5, 0.85);
    this.scene.add(ambient);

    // Tavandaki Devasa Oda Lambası (Sıcak Güneş / Avize Işığı)
    const mainSun = new THREE.DirectionalLight(0xfff7ed, 1.85);
    mainSun.position.set(45, 95, 30);
    mainSun.castShadow = true;
    mainSun.shadow.mapSize.width = 2048;
    mainSun.shadow.mapSize.height = 2048;
    mainSun.shadow.camera.near = 10;
    mainSun.shadow.camera.far = 280;
    mainSun.shadow.camera.left = -110;
    mainSun.shadow.camera.right = 110;
    mainSun.shadow.camera.top = 110;
    mainSun.shadow.camera.bottom = -110;
    mainSun.shadow.bias = -0.0005;
    this.scene.add(mainSun);

    // Masa Lambası Spot Işığı (Vintage Amber Desk Lamp Cone)
    const deskLamp = new THREE.SpotLight(0xf59e0b, 2.2, 180, Math.PI / 3.5, 0.45);
    deskLamp.position.set(-35, 75, -20);
    deskLamp.target.position.set(0, 0, 0);
    this.scene.add(deskLamp);
    this.scene.add(deskLamp.target);

    // Yumuşak Neon Mavi Kontur Işığı (Retro Dreamcast / 90s Akrilik Mavi Dolgu)
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    rimLight.position.set(-60, 40, -50);
    this.scene.add(rimLight);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. RETRO DOKU ÜRETECİLERİ (PROCEDURAL CANVAS TEXTURES)
  // ═══════════════════════════════════════════════════════════════════════════
  private createParquetFloorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Sıcak 90'lar meşe parke rengi
    ctx.fillStyle = '#9a6136';
    ctx.fillRect(0, 0, 512, 512);

    // Parke şeritleri
    const numPlanks = 8;
    const plankH = 512 / numPlanks;
    for (let i = 0; i < numPlanks; i++) {
      const y = i * plankH;
      // Ahşap ton varyasyonu
      const tint = (i % 2 === 0) ? '#a56c3e' : '#8f572d';
      ctx.fillStyle = tint;
      ctx.fillRect(0, y, 512, plankH);

      // İnce damarlar (wood grain)
      ctx.strokeStyle = 'rgba(60, 30, 10, 0.18)';
      ctx.lineWidth = 1.5;
      for (let g = 0; g < 4; g++) {
        ctx.beginPath();
        ctx.moveTo(0, y + g * (plankH / 4) + Math.random() * 4);
        ctx.bezierCurveTo(170, y + 5, 340, y + plankH - 5, 512, y + g * (plankH / 4) + 6);
        ctx.stroke();
      }

      // Derz boşluğu (Bevel seam)
      ctx.strokeStyle = '#3b1d08';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();

      // Dikey birleşim derzleri
      const vOffset = (i % 3) * 170;
      ctx.beginPath();
      ctx.moveTo(vOffset, y);
      ctx.lineTo(vOffset, y + plankH);
      ctx.moveTo(vOffset + 256, y);
      ctx.lineTo(vOffset + 256, y + plankH);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(12, 10);
    return tex;
  }

  private createTrackAsphaltTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Koyu slot-araba / oyuncak asfalt zemini
    ctx.fillStyle = '#1c212d';
    ctx.fillRect(0, 0, 512, 512);

    // Asfalt gürültüsü
    for (let i = 0; i < 4000; i++) {
      const rx = Math.random() * 512;
      const ry = Math.random() * 512;
      const gray = Math.floor(25 + Math.random() * 25);
      ctx.fillStyle = `rgba(${gray}, ${gray + 4}, ${gray + 8}, 0.25)`;
      ctx.fillRect(rx, ry, 2, 2);
    }

    // Sol & Sağ Lastik Yanık İzi Kanalları (Tire Wear Grooves)
    ctx.fillStyle = 'rgba(10, 13, 20, 0.45)';
    ctx.fillRect(70, 0, 75, 512);
    ctx.fillRect(367, 0, 75, 512);

    // Beyaz Dış Çizgiler (Kenar sınırları)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(16, 0, 10, 512);
    ctx.fillRect(486, 0, 10, 512);

    // Kesikli Sarı Retro Merkez Çizgisi
    ctx.fillStyle = '#facc15';
    const dashLen = 42;
    const gapLen = 22;
    for (let y = 0; y < 512; y += dashLen + gapLen) {
      ctx.fillRect(250, y, 12, dashLen);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 28);
    return tex;
  }

  private createSodaCanTexture(label: string, mainColor: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Metalik renkli kutu arka planı
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(0.3, mainColor);
    grad.addColorStop(0.7, '#38bdf8');
    grad.addColorStop(1, '#0284c7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    // 90'lar Retro Dalga Şeritleri
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(0, 60);
    ctx.bezierCurveTo(150, 140, 350, 20, 512, 100);
    ctx.lineTo(512, 180);
    ctx.bezierCurveTo(350, 100, 150, 220, 0, 140);
    ctx.closePath();
    ctx.fill();

    // Büyük 90'lar İtalik Logo ("VOLT COLA" / "RC RUSH")
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 46px system-ui, Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;
    ctx.fillText(label.toUpperCase(), 256, 115);

    // Alt slogan ve yıldızlar
    ctx.font = '800 18px monospace';
    ctx.fillStyle = '#facc15';
    ctx.fillText('⚡ 100% RC TURBO POWER ⚡', 256, 155);

    // Barkod
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(380, 185, 90, 45);
    ctx.fillStyle = '#0f172a';
    for (let x = 390; x < 460; x += 4) {
      if (Math.random() > 0.3) {
        ctx.fillRect(x, 192, 2.5, 30);
      }
    }

    return new THREE.CanvasTexture(canvas);
  }

  private createBatteryTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Altın sarısı üst kutup bandı (Duracell / Volt Cell tarzı)
    ctx.fillStyle = '#d97706';
    ctx.fillRect(0, 0, 512, 75);

    // Siyah gövde
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 75, 512, 181);

    // Parlak metalik altın ayrım çizgisi
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(0, 73, 512, 5);

    // Yazılar
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VOLT CELL', 256, 140);

    ctx.font = '800 20px monospace';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('ULTRA ALKALINE 1.5V [MAX]', 256, 175);

    // Pozitif '+' işareti
    ctx.font = '900 48px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('+', 80, 55);
    ctx.fillText('+', 432, 55);

    return new THREE.CanvasTexture(canvas);
  }

  private createCardboardTexture(label: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Kraft koli karton rengi
    ctx.fillStyle = '#a16207';
    ctx.fillRect(0, 0, 512, 512);

    // Karton elyaf dokusu
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    for (let i = 0; i < 512; i += 8) {
      ctx.fillRect(i, 0, 4, 512);
    }

    // Kahverengi koli bandı (ortadan geçen bant)
    ctx.fillStyle = 'rgba(120, 53, 15, 0.75)';
    ctx.fillRect(0, 230, 512, 52);

    // Kırmızı Kırılabilir Damgası ("FRAGILE")
    ctx.save();
    ctx.translate(256, 140);
    ctx.rotate(-0.08);
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 6;
    ctx.strokeRect(-130, -35, 260, 70);
    ctx.fillStyle = '#dc2626';
    ctx.font = '900 38px system-ui, Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.toUpperCase(), 0, 0);
    ctx.restore();

    // Yukarı oklar
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 42px sans-serif';
    ctx.fillText('↑↑', 120, 390);

    // Barkod etiketi
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(300, 350, 150, 70);
    ctx.fillStyle = '#0f172a';
    for (let b = 315; b < 435; b += 5) {
      if (Math.random() > 0.25) {
        ctx.fillRect(b, 362, 3, 46);
      }
    }

    return new THREE.CanvasTexture(canvas);
  }

  private createStartBannerTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Sarı arka plan
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 512, 128);

    // Dama desenli (Checkered) üst ve alt şerit
    const boxSize = 16;
    for (let x = 0; x < 512; x += boxSize) {
      for (let y = 0; y < 32; y += boxSize) {
        if ((Math.floor(x / boxSize) + Math.floor(y / boxSize)) % 2 === 0) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(x, y, boxSize, boxSize);
        }
      }
      for (let y = 96; y < 128; y += boxSize) {
        if ((Math.floor(x / boxSize) + Math.floor(y / boxSize)) % 2 === 0) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(x, y, boxSize, boxSize);
        }
      }
    }

    // Ana Başlık
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 36px system-ui, Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ RE-VOLT RC CUP 99 ★', 256, 68);

    ctx.font = '800 16px monospace';
    ctx.fillStyle = '#dc2626';
    ctx.fillText('TOY WORKSHOP STAGE 01', 256, 88);

    return new THREE.CanvasTexture(canvas);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. ODA ÇEVRESİ (SÜPÜRGELİK, DUVARLAR, ELEKTRİK PRİZİ, MASA AYAKLARI)
  // ═══════════════════════════════════════════════════════════════════════════
  private buildRoomEnvironment() {
    // 1. Meşe Parke Zemin
    const floorGeo = new THREE.PlaneGeometry(280, 220);
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.createParquetFloorTexture(),
      roughness: 0.45,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 2. Devasa Ahşap Süpürgelik (Skirting Board / Baseboard)
    const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x3e2312, roughness: 0.5 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });

    // Arka Duvar & Süpürgelik (Z = +105)
    const backSkirting = new THREE.Mesh(new THREE.BoxGeometry(280, 8, 2.5), baseboardMat);
    backSkirting.position.set(0, 4, 105);
    backSkirting.receiveShadow = true;
    this.scene.add(backSkirting);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(280, 90, 4), wallMat);
    backWall.position.set(0, 50, 107);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // Ön Duvar & Süpürgelik (Z = -105)
    const frontSkirting = new THREE.Mesh(new THREE.BoxGeometry(280, 8, 2.5), baseboardMat);
    frontSkirting.position.set(0, 4, -105);
    this.scene.add(frontSkirting);

    // Sol Duvar & Süpürgelik (X = -138)
    const leftSkirting = new THREE.Mesh(new THREE.BoxGeometry(2.5, 8, 210), baseboardMat);
    leftSkirting.position.set(-138, 4, 0);
    this.scene.add(leftSkirting);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(4, 90, 210), wallMat);
    leftWall.position.set(-140, 50, 0);
    this.scene.add(leftWall);

    // Sağ Duvar & Süpürgelik (X = +138)
    const rightSkirting = new THREE.Mesh(new THREE.BoxGeometry(2.5, 8, 210), baseboardMat);
    rightSkirting.position.set(138, 4, 0);
    this.scene.add(rightSkirting);

    // 3. Devasa Duvar Elektrik Prizi & Fiş Kordonu (Macro Scale Touch)
    const socketGroup = new THREE.Group();
    socketGroup.position.set(35, 18, 105);

    const socketPlate = new THREE.Mesh(
      new THREE.BoxGeometry(9, 13, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3 })
    );
    socketGroup.add(socketPlate);

    // Priz Delikleri (İki delikli priz)
    const holeGeo = new THREE.CylinderGeometry(0.8, 0.8, 1.5, 12);
    holeGeo.rotateX(Math.PI / 2);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
    const hole1 = new THREE.Mesh(holeGeo, holeMat);
    hole1.position.set(-2.2, 0, 0.4);
    const hole2 = new THREE.Mesh(holeGeo, holeMat);
    hole2.position.set(2.2, 0, 0.4);
    socketGroup.add(hole1, hole2);

    // Fiş ve Yere Kıvrılan Kalın Siyah Güç Kablosu
    const plugMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 4.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 })
    );
    plugMesh.rotation.x = Math.PI / 2;
    plugMesh.position.set(0, 0, 2.5);
    socketGroup.add(plugMesh);
    this.scene.add(socketGroup);

    // Kalın Siyah Kablo (Yere uzanan bezier tüp)
    const cableCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(35, 18, 107),
      new THREE.Vector3(35, 6, 103),
      new THREE.Vector3(45, 0.4, 98),
      new THREE.Vector3(65, 0.4, 85)
    );
    const cableGeo = new THREE.TubeGeometry(cableCurve, 24, 0.55, 8, false);
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.7 });
    const cableMesh = new THREE.Mesh(cableGeo, cableMat);
    cableMesh.castShadow = true;
    this.scene.add(cableMesh);

    // 4. Devasa Ahşap Masa/Tezgah Ayakları (Köşelerde yükselen silindir sütunlar)
    const legGeo = new THREE.CylinderGeometry(3.6, 4.2, 85, 16);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x27170a, roughness: 0.4 });
    const legPositions = [
      [-105, 42.5, -80],
      [105, 42.5, -80],
      [-105, 42.5, 80],
      [105, 42.5, 80],
    ];
    legPositions.forEach((pos) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(pos[0], pos[1], pos[2]);
      leg.castShadow = true;
      this.scene.add(leg);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. PİST, EĞİK RE-VOLT BORDÜRLERİ & START KEMERİ
  // ═══════════════════════════════════════════════════════════════════════════
  private buildTrack() {
    const points = TRACK_WAYPOINTS.map((wp) => new THREE.Vector3(wp.x, 0.05, wp.z));
    const curve = new THREE.CatmullRomCurve3(points, true);

    const numSegments = 300;
    const curvePoints = curve.getPoints(numSegments);
    const halfWidth = TRACK_CONFIG.trackWidth / 2;

    const trackGeo = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= numSegments; i++) {
      const p = curvePoints[i % numSegments];
      const nextP = curvePoints[(i + 1) % numSegments];
      const dir = new THREE.Vector3().subVectors(nextP, p).normalize();
      const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

      const left = new THREE.Vector3().copy(p).addScaledVector(normal, -halfWidth);
      const right = new THREE.Vector3().copy(p).addScaledVector(normal, halfWidth);

      vertices.push(left.x, 0.08, left.z);
      vertices.push(right.x, 0.08, right.z);

      const v = (i / numSegments);
      uvs.push(0, v, 1, v);

      if (i < numSegments) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    trackGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    trackGeo.setIndex(indices);
    trackGeo.computeVertexNormals();

    // Prosedürel Gerçekçi Asfalt Malzemesi
    const trackMat = new THREE.MeshStandardMaterial({
      map: this.createTrackAsphaltTexture(),
      roughness: 0.8,
      metalness: 0.15,
    });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.receiveShadow = true;
    this.scene.add(trackMesh);

    // Kırmızı-Beyaz Eğimli Re-Volt Viraj Bordürleri (3D Beveled Curbs)
    this.buildCurbs(curve, numSegments, halfWidth);

    // Start / Finish Gantry (Checkered Truss Köprüsü & Işıklar)
    this.buildStartFinishGantry();
  }

  private buildCurbs(curve: THREE.CatmullRomCurve3, segments: number, halfWidth: number) {
    const points = curve.getPoints(segments);
    const curbMatRed = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 });
    const curbMatWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });

    // Eğimli prizmatik bordür geometrisi
    const curbGeo = new THREE.BoxGeometry(1.2, 0.35, 1.9);

    for (let i = 0; i < segments; i += 2) {
      const p = points[i];
      const nextP = points[(i + 1) % segments];
      const dir = new THREE.Vector3().subVectors(nextP, p).normalize();
      const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      const angle = Math.atan2(dir.x, dir.z);
      const mat = Math.floor(i / 2) % 2 === 0 ? curbMatRed : curbMatWhite;

      // Sol Bordür (İç/Dış Viraj)
      const leftCurb = new THREE.Mesh(curbGeo, mat);
      leftCurb.position.copy(p).addScaledVector(normal, -(halfWidth + 0.6));
      leftCurb.position.y = 0.18;
      leftCurb.rotation.y = angle;
      leftCurb.rotation.z = -0.15; // Dışa hafif yatık
      leftCurb.receiveShadow = true;
      leftCurb.castShadow = true;
      this.scene.add(leftCurb);

      // Sağ Bordür
      const rightCurb = new THREE.Mesh(curbGeo, mat);
      rightCurb.position.copy(p).addScaledVector(normal, halfWidth + 0.6);
      rightCurb.position.y = 0.18;
      rightCurb.rotation.y = angle;
      rightCurb.rotation.z = 0.15;
      rightCurb.receiveShadow = true;
      rightCurb.castShadow = true;
      this.scene.add(rightCurb);
    }
  }

  private buildStartFinishGantry() {
    const gantry = new THREE.Group();

    // Kafes Çelik Dikmeler (Steel Truss Posts)
    const postMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
    const postGeo = new THREE.CylinderGeometry(0.55, 0.65, 10.5, 12);

    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(0, 5.25, -53.8);
    leftPost.castShadow = true;
    gantry.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(0, 5.25, -36.2);
    rightPost.castShadow = true;
    gantry.add(rightPost);

    // Üst Kiriş (Truss Beam)
    const beamGeo = new THREE.BoxGeometry(1.6, 1.6, 19);
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 10.2, -45);
    beam.castShadow = true;
    gantry.add(beam);

    // Checkered Start Banner ("★ RE-VOLT RC CUP 99 ★")
    const bannerGeo = new THREE.PlaneGeometry(16, 3.2);
    const bannerMat = new THREE.MeshBasicMaterial({
      map: this.createStartBannerTexture(),
      side: THREE.DoubleSide,
    });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.rotation.y = Math.PI / 2;
    banner.position.set(0, 8.2, -45);
    gantry.add(banner);

    // 4'lü Retro Yarış Başlama Lambaları (3 Kırmızı + 1 Yeşil)
    this.gantryLights = [];
    const lightOffsets = [-4.5, -1.5, 1.5, 4.5];
    const lampGeo = new THREE.SphereGeometry(0.5, 16, 16);

    lightOffsets.forEach((offsetZ, idx) => {
      const lampMat = new THREE.MeshStandardMaterial({
        color: idx < 3 ? 0xef4444 : 0x22c55e,
        emissive: idx < 3 ? 0xef4444 : 0x22c55e,
        emissiveIntensity: 0.2,
      });
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(0.85, 10.2, -45 + offsetZ);
      gantry.add(lamp);
      this.gantryLights.push(lamp);
    });

    // Zemin Checkered Start / Finish Çizgisi
    const lineCanvas = document.createElement('canvas');
    lineCanvas.width = 128;
    lineCanvas.height = 128;
    const lCtx = lineCanvas.getContext('2d')!;
    const cSize = 16;
    for (let x = 0; x < 128; x += cSize) {
      for (let y = 0; y < 128; y += cSize) {
        lCtx.fillStyle = (Math.floor(x / cSize) + Math.floor(y / cSize)) % 2 === 0 ? '#f8fafc' : '#09090b';
        lCtx.fillRect(x, y, cSize, cSize);
      }
    }
    const lineTex = new THREE.CanvasTexture(lineCanvas);
    const lineGeo = new THREE.PlaneGeometry(2.4, 15);
    const lineMat = new THREE.MeshBasicMaterial({ map: lineTex });
    const lineMesh = new THREE.Mesh(lineGeo, lineMat);
    lineMesh.rotation.x = -Math.PI / 2;
    lineMesh.position.set(0, 0.09, -45);
    this.scene.add(lineMesh);

    this.scene.add(gantry);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. LASTİK İZİ (SKIDMARKS) SİSTEMİ
  // ═══════════════════════════════════════════════════════════════════════════
  private initSkidmarks() {
    const vertexCount = this.maxSkidQuads * 6;
    this.skidPositions = new Float32Array(vertexCount * 3);

    const skidGeo = new THREE.BufferGeometry();
    skidGeo.setAttribute('position', new THREE.BufferAttribute(this.skidPositions, 3));

    const skidMat = new THREE.MeshBasicMaterial({
      color: 0x09090b,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    this.skidMesh = new THREE.Mesh(skidGeo, skidMat);
    this.scene.add(this.skidMesh);
  }

  private addSkidQuad(p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, p4: THREE.Vector3) {
    const i = (this.skidQuadIndex % this.maxSkidQuads) * 18;
    const pos = this.skidPositions;

    pos[i] = p1.x;     pos[i + 1] = 0.055; pos[i + 2] = p1.z;
    pos[i + 3] = p2.x; pos[i + 4] = 0.055; pos[i + 5] = p2.z;
    pos[i + 6] = p3.x; pos[i + 7] = 0.055; pos[i + 8] = p3.z;

    pos[i + 9] = p3.x;  pos[i + 10] = 0.055; pos[i + 11] = p3.z;
    pos[i + 12] = p2.x; pos[i + 13] = 0.055; pos[i + 14] = p2.z;
    pos[i + 15] = p4.x; pos[i + 16] = 0.055; pos[i + 17] = p4.z;

    this.skidQuadIndex++;
    this.skidMesh.geometry.attributes.position.needsUpdate = true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. DEVASA 90'LAR ENGELLERİ (GAZOZ KUTUSU, PİLLER, KUPA, KİTAP, İNGİLİZ ANAHTARI)
  // ═══════════════════════════════════════════════════════════════════════════
  private buildDecorations() {
    TRACK_DECORATIONS.forEach((dec) => {
      const group = new THREE.Group();
      group.position.set(dec.x, 0, dec.z);
      group.rotation.y = dec.rotation;
      group.scale.setScalar(dec.scale);

      // ─── 1. DEV ALÜMİNYUM GAZOZ KUTUSU (VOLT COLA) ───
      if (dec.type === 'can') {
        const canMat = new THREE.MeshStandardMaterial({
          map: this.createSodaCanTexture(dec.label || 'VOLT COLA', dec.color || '#0ea5e9'),
          metalness: 0.85,
          roughness: 0.25,
        });
        const canGeo = new THREE.CylinderGeometry(1.8, 1.8, 5.5, 24);
        const can = new THREE.Mesh(canGeo, canMat);
        can.position.y = 2.75;
        can.castShadow = true;
        group.add(can);

        // Kutu Üst Gümüş Kapağı ve Dudak Kıvrımı
        const silverMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.2 });
        const rim = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.12, 8, 24), silverMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 5.5;
        group.add(rim);

        // Açma Halkası (Pull Tab)
        const tab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.9), silverMat);
        tab.position.set(0.3, 5.55, 0);
        group.add(tab);
      }

      // ─── 2. DEV AA PİLLER ("VOLT CELL ULTRA") ───
      else if (dec.type === 'battery') {
        const batteryMat = new THREE.MeshStandardMaterial({
          map: this.createBatteryTexture(),
          metalness: 0.7,
          roughness: 0.35,
        });
        const batteryGeo = new THREE.CylinderGeometry(1.2, 1.2, 5.0, 20);
        const battery = new THREE.Mesh(batteryGeo, batteryMat);
        battery.position.y = 1.2;
        battery.castShadow = true;
        group.add(battery);

        // Pozitif (+) Tepe Çıkıntısı
        const nubMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });
        const nub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.4, 16), nubMat);
        nub.position.set(0, 3.8, 0);
        group.add(nub);
      }

      // ─── 3. DEV PORSELEN KAHVE KUPASI & KULP ───
      else if (dec.type === 'mug') {
        const mugMat = new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          roughness: 0.15,
          metalness: 0.05,
        });
        const mugGeo = new THREE.CylinderGeometry(2.5, 2.1, 5.0, 24);
        const mug = new THREE.Mesh(mugGeo, mugMat);
        mug.position.y = 2.5;
        mug.castShadow = true;
        group.add(mug);

        // Kavisli Kulp (Torus)
        const handle = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.35, 12, 20, Math.PI), mugMat);
        handle.rotation.z = Math.PI / 2;
        handle.position.set(2.4, 2.5, 0);
        handle.castShadow = true;
        group.add(handle);

        // Sıcak Kahve Yüzeyi
        const coffeeMat = new THREE.MeshStandardMaterial({ color: 0x381907, roughness: 0.1, metalness: 0.1 });
        const coffee = new THREE.Mesh(new THREE.CircleGeometry(2.35, 20), coffeeMat);
        coffee.rotation.x = -Math.PI / 2;
        coffee.position.y = 4.8;
        group.add(coffee);
      }

      // ─── 4. VINTAGE KİTAPLAR / ÇİZGİ ROMANLAR ───
      else if (dec.type === 'book') {
        const bookMat = new THREE.MeshStandardMaterial({
          color: dec.color || 0xdc2626,
          roughness: 0.4,
          metalness: 0.1,
        });
        const bookGeo = new THREE.BoxGeometry(4.8, 1.25, 7.0);
        const book = new THREE.Mesh(bookGeo, bookMat);
        book.position.y = 0.62;
        book.castShadow = true;
        group.add(book);

        // Sarımtırak Sayfalar
        const pagesMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.9 });
        const pages = new THREE.Mesh(new THREE.BoxGeometry(4.55, 1.05, 6.7), pagesMat);
        pages.position.set(0.12, 0.62, 0);
        group.add(pages);
      }

      // ─── 5. OYUNCAK ALFABE BLOKLARI (WOODEN LETTER BLOCKS) ───
      else if (dec.type === 'block') {
        const blockMat = new THREE.MeshStandardMaterial({ color: dec.color || 0x16a34a, roughness: 0.35 });
        const blockGeo = new THREE.BoxGeometry(3.2, 3.2, 3.2);
        const block = new THREE.Mesh(blockGeo, blockMat);
        block.position.y = 1.6;
        block.castShadow = true;
        group.add(block);

        // Yüzeydeki Harf İzdüşümü (R, C, 9)
        const letterCanvas = document.createElement('canvas');
        letterCanvas.width = 128;
        letterCanvas.height = 128;
        const lCtx = letterCanvas.getContext('2d')!;
        lCtx.fillStyle = '#fef08a';
        lCtx.font = '900 85px system-ui, sans-serif';
        lCtx.textAlign = 'center';
        lCtx.textBaseline = 'middle';
        lCtx.fillText(dec.label || 'R', 64, 68);

        const letterTex = new THREE.CanvasTexture(letterCanvas);
        const letterPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(2.4, 2.4),
          new THREE.MeshBasicMaterial({ map: letterTex, transparent: true })
        );
        letterPlane.position.set(0, 1.6, 1.62);
        group.add(letterPlane);
      }

      // ─── 6. KURŞUN KALEMLER (HEXAGONAL PENCILS) ───
      else if (dec.type === 'pencil') {
        const pencilMat = new THREE.MeshStandardMaterial({ color: dec.color || 0xf59e0b, roughness: 0.4 });
        const pencilGeo = new THREE.CylinderGeometry(0.35, 0.35, 9.0, 6);
        pencilGeo.rotateZ(Math.PI / 2);
        const pencil = new THREE.Mesh(pencilGeo, pencilMat);
        pencil.position.y = 0.35;
        pencil.castShadow = true;
        group.add(pencil);

        // Uçtaki Açılmış Tahta Koni & Grafit Uç
        const coneMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.8 });
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 12), coneMat);
        cone.rotation.z = -Math.PI / 2;
        cone.position.set(5.1, 0.35, 0);
        group.add(cone);

        const graphite = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 8), new THREE.MeshBasicMaterial({ color: 0x18181b }));
        graphite.rotation.z = -Math.PI / 2;
        graphite.position.set(5.5, 0.35, 0);
        group.add(graphite);

        // Arkadaki Silgi ve Metal Bilezik
        const ferrule = new THREE.Mesh(
          new THREE.CylinderGeometry(0.36, 0.36, 0.7, 12),
          new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.3 })
        );
        ferrule.rotation.z = Math.PI / 2;
        ferrule.position.set(-4.7, 0.35, 0);
        group.add(ferrule);

        const eraser = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 0.6, 12),
          new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.6 })
        );
        eraser.rotation.z = Math.PI / 2;
        eraser.position.set(-5.2, 0.35, 0);
        group.add(eraser);
      }

      // ─── 7. DEV SİLGİ (RETRO PELIKAN ERASER) ───
      else if (dec.type === 'eraser') {
        const eraserGeo = new THREE.BoxGeometry(4.0, 1.2, 2.2);
        const blueMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6 });
        const eraser = new THREE.Mesh(eraserGeo, blueMat);
        eraser.position.y = 0.6;
        eraser.castShadow = true;
        group.add(eraser);

        // Kırmızı/Pembe Kurşun Kalem Tarafı
        const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 });
        const redHalf = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.22, 2.22), redMat);
        redHalf.position.set(-1.0, 0.6, 0);
        group.add(redHalf);
      }

      // ─── 8. DEV İNGİLİZ ANAHTARI (CHROME ADJUSTABLE WRENCH) ───
      else if (dec.type === 'wrench') {
        const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.2 });
        // Sap
        const handle = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.4, 1.4), chromeMat);
        handle.position.set(0, 0.2, 0);
        handle.castShadow = true;
        group.add(handle);

        // Çene Başı
        const head = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.6, 2.8), chromeMat);
        head.position.set(4.8, 0.2, 0);
        head.castShadow = true;
        group.add(head);

        // Çene Ağız Boşluğu
        const jawCut = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.2), new THREE.MeshBasicMaterial({ color: 0x09090b }));
        jawCut.position.set(5.5, 0.2, 0);
        group.add(jawCut);
      }

      // ─── 9. DEV KARGO KOLİSİ ("FRAGILE ACME") ───
      else if (dec.type === 'box') {
        const boxMat = new THREE.MeshStandardMaterial({
          map: this.createCardboardTexture(dec.label || 'FRAGILE'),
          roughness: 0.8,
        });
        const box = new THREE.Mesh(new THREE.BoxGeometry(7.5, 6.0, 7.5), boxMat);
        box.position.y = 3.0;
        box.castShadow = true;
        group.add(box);
      }

      // ─── 10. DİKİLİ DOMİNO TAŞLARI ───
      else if (dec.type === 'domino') {
        const dominoMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.25 });
        const domino = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.8, 2.0), dominoMat);
        domino.position.y = 1.9;
        domino.castShadow = true;
        group.add(domino);

        // Beyaz Ayrım Çizgisi
        const divMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
        const div = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.1, 1.8), divMat);
        div.position.set(0, 1.9, 0);
        group.add(div);
      }

      this.scene.add(group);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. PARÇACIK VE TOZ SİSTEMLERİ (EXHAUST, BOOST FLAME, AMBIENT DUST)
  // ═══════════════════════════════════════════════════════════════════════════
  private setupParticles() {
    this.particlePositions = new Float32Array(this.maxParticles * 3);
    this.particleVelocities = new Float32Array(this.maxParticles * 3);
    this.particleLifetimes = new Float32Array(this.maxParticles);
    this.particleColors = new Float32Array(this.maxParticles * 3);

    for (let i = 0; i < this.maxParticles; i++) {
      this.particlePositions[i * 3 + 1] = -100;
      this.particleLifetimes[i] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.65,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  private setupAmbientDust() {
    const dustPositions = new Float32Array(this.maxDust * 3);
    for (let i = 0; i < this.maxDust; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 180;
      dustPositions[i * 3 + 1] = 1 + Math.random() * 25;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 140;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.35,
      color: 0xfef08a,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.dustParticles = new THREE.Points(geo, mat);
    this.scene.add(this.dustParticles);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. 1:10 ÖLÇEKLİ RE-VOLT RC BUGGY ARABA MODELİ
  // ═══════════════════════════════════════════════════════════════════════════
  private createCarMesh(car: CarSnapshot): THREE.Group {
    const chassisRoot = new THREE.Group();

    // 1. Zemin Damla Gölgesi (Blob Shadow - Yükseklik İllüzyonu)
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 64;
    shadowCanvas.height = 64;
    const sCtx = shadowCanvas.getContext('2d')!;
    const grad = sCtx.createRadialGradient(32, 32, 6, 32, 32, 30);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.4)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 64, 64);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
    const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.2), shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.02;
    chassisRoot.add(shadowMesh);

    // 2. Lexan Polikarbonat Kep (BodyShell - Pitch & Roll Eğilir)
    const bodyShell = new THREE.Group();

    // Parlak Lexan Kep (Re-Volt Plastik Kep Materyali)
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(car.color),
      metalness: 0.2,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });

    // Ana Gövde Şasisi
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.65, 3.2), bodyMat);
    mainBody.position.y = 0.55;
    mainBody.castShadow = true;
    bodyShell.add(mainBody);

    // Ön Burun / Kaput Eğimli Parçası (Aero Nose)
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 1.2), bodyMat);
    nose.position.set(0, 0.45, 1.8);
    nose.rotation.x = 0.15;
    nose.castShadow = true;
    bodyShell.add(nose);

    // Ön Çarpışma Barı (Tubular Bull-Bar Bumper)
    const bumperMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.5 });
    const bullBar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.9, 8), bumperMat);
    bullBar.rotation.z = Math.PI / 2;
    bullBar.position.set(0, 0.35, 2.45);
    bodyShell.add(bullBar);

    // Dış Takla Kafesi (Roll Cage Tubular Bars)
    const cageMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
    const cageBar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8), cageMat);
    cageBar1.rotation.x = 0.4;
    cageBar1.position.set(-0.6, 1.0, 0.1);
    const cageBar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8), cageMat);
    cageBar2.rotation.x = 0.4;
    cageBar2.position.set(0.6, 1.0, 0.1);
    bodyShell.add(cageBar1, cageBar2);

    // Karartılmış Kokpit / Kabin Camı
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0b0f19, roughness: 0.05, metalness: 0.95 });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.55, 1.3), glassMat);
    glass.position.set(0, 0.95, -0.15);
    bodyShell.add(glass);

    // Kokpit İçi Sürücü Kaskı (Stylized Mini Pilot)
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), helmetMat);
    helmet.position.set(0, 1.05, -0.1);
    bodyShell.add(helmet);

    // Arka Yüksek Downforce Kanadı (RC Rear Spoiler)
    const spoilerMat = new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.8, roughness: 0.25 });
    const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.12, 0.65), spoilerMat);
    spoilerWing.position.set(0, 1.25, -1.45);
    spoilerWing.rotation.x = -0.12;
    spoilerWing.castShadow = true;
    bodyShell.add(spoilerWing);

    // Spoiler Yan Kanatçıkları (Endplates)
    const endplateL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.7), spoilerMat);
    endplateL.position.set(-0.92, 1.25, -1.45);
    const endplateR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.7), spoilerMat);
    endplateR.position.set(0.92, 1.25, -1.45);
    bodyShell.add(endplateL, endplateR);

    // Çift Krom Egzoz Çıkışları
    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 });
    const exhL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.45, 12), exhaustMat);
    exhL.rotation.x = Math.PI / 2;
    exhL.position.set(-0.35, 0.45, -1.65);
    const exhR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.45, 12), exhaustMat);
    exhR.rotation.x = Math.PI / 2;
    exhR.position.set(0.35, 0.45, -1.65);
    bodyShell.add(exhL, exhR);

    // 4 Köşede Sarmal Amortisör Yayları (Coiled Springs)
    const springMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.3 });
    const springGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.48, 8);
    const springOffsets = [
      [-0.65, 0.42, 1.1],
      [0.65, 0.42, 1.1],
      [-0.65, 0.42, -1.1],
      [0.65, 0.42, -1.1],
    ];
    springOffsets.forEach((pos) => {
      const spring = new THREE.Mesh(springGeo, springMat);
      spring.position.set(pos[0], pos[1], pos[2]);
      bodyShell.add(spring);
    });

    // 3. Ön Aktif Farlar (Gerçek Işık Saçan Far Lensleri)
    const headLensMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const headLensL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), headLensMat);
    headLensL.position.set(-0.55, 0.52, 2.3);
    const headLensR = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), headLensMat);
    headLensR.position.set(0.55, 0.52, 2.3);
    bodyShell.add(headLensL, headLensR);

    // Zemin Aydınlatan Far Spotu
    const headSpot = new THREE.SpotLight(0xfff7ed, 2.2, 28, Math.PI / 5, 0.45);
    headSpot.position.set(0, 0.6, 2.3);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0.1, 15);
    bodyShell.add(headSpot);
    bodyShell.add(spotTarget);
    headSpot.target = spotTarget;
    this.carHeadlights.set(car.id, [headSpot]);

    // Arka Kırmızı LED Farlar
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.8 });
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.08), tailMat);
    tailL.position.set(-0.6, 0.6, -1.62);
    const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.08), tailMat);
    tailR.position.set(0.6, 0.6, -1.62);
    bodyShell.add(tailL, tailR);
    this.carTaillights.set(car.id, [tailL, tailR]);

    // 4. Esnek Yaylı RC Anten (Spring-Bone Antenna)
    const antennaGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0.45, 0.95, -1.35),
      new THREE.Vector3(0.45, 1.85, -1.35),
      new THREE.Vector3(0.45, 2.85, -1.35),
    ]);
    const antennaMat = new THREE.LineBasicMaterial({ color: 0xe2e8f0, linewidth: 2.5 });
    const antennaLine = new THREE.Line(antennaGeo, antennaMat);
    bodyShell.add(antennaLine);

    // Anten Uç Güvenlik Boncuğu (Parlak Turuncu Top)
    const tipMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xf97316 })
    );
    tipMesh.position.set(0.45, 2.85, -1.35);
    bodyShell.add(tipMesh);

    this.antennaStates.set(car.id, {
      mastLine: antennaLine,
      tipMesh,
      tipLocalX: 0.45,
      tipLocalZ: -1.35,
      velX: 0,
      velZ: 0,
    });

    chassisRoot.add(bodyShell);
    this.bodyShells.set(car.id, bodyShell);

    // 5. Dişli Off-Road Lastikler & Derin Göbekli Jantlar (Deep-Dish Rims)
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.95 });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.9,
      roughness: 0.15,
    });

    const wheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.4, 18);
    wheelGeo.rotateZ(Math.PI / 2);

    const rimGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.42, 12);
    rimGeo.rotateZ(Math.PI / 2);

    const wheels: THREE.Mesh[] = [];
    const wheelOffsets = [
      [-0.98, 0.46, 1.1],
      [0.98, 0.46, 1.1],
      [-0.98, 0.46, -1.1],
      [0.98, 0.46, -1.1],
    ];

    wheelOffsets.forEach((pos) => {
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.position.set(pos[0], pos[1], pos[2]);
      tire.castShadow = true;

      // Jant Göbeği
      const rim = new THREE.Mesh(rimGeo, rimMat);
      tire.add(rim);

      chassisRoot.add(tire);
      wheels.push(tire);
    });
    this.wheelMeshes.set(car.id, wheels);

    // 6. Alt Neon Haresi (Underglow Aura)
    const neonGeo = new THREE.RingGeometry(0.8, 1.5, 16);
    const neonMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(car.color),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    const neon = new THREE.Mesh(neonGeo, neonMat);
    neon.rotation.x = -Math.PI / 2;
    neon.position.y = 0.05;
    chassisRoot.add(neon);

    return chassisRoot;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. 3D RE-VOLT GÜÇ KUTUSU (MYSTERY BOX) & MERMİLER
  // ═══════════════════════════════════════════════════════════════════════════
  private createPickupMesh(): THREE.Group {
    const group = new THREE.Group();

    // Dış Buzlu Kristal Küp (Translucent Frosted Crystal Cube)
    const cubeMat = new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.65,
      ior: 1.45,
      emissive: 0xeab308,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.85,
    });
    const cubeGeo = new THREE.BoxGeometry(1.7, 1.7, 1.7);
    const cube = new THREE.Mesh(cubeGeo, cubeMat);
    group.add(cube);

    // İçte Dönen 3D Soru İşareti / Yıldız İkonu
    const innerIconCanvas = document.createElement('canvas');
    innerIconCanvas.width = 128;
    innerIconCanvas.height = 128;
    const iCtx = innerIconCanvas.getContext('2d')!;
    iCtx.fillStyle = '#ffffff';
    iCtx.font = '900 90px system-ui, sans-serif';
    iCtx.textAlign = 'center';
    iCtx.textBaseline = 'middle';
    iCtx.shadowColor = '#38bdf8';
    iCtx.shadowBlur = 12;
    iCtx.fillText('?', 64, 66);

    const innerTex = new THREE.CanvasTexture(innerIconCanvas);
    const innerSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: innerTex, transparent: true, depthTest: false })
    );
    innerSprite.scale.set(1.4, 1.4, 1.4);
    group.add(innerSprite);

    // Dönen Eksen Halkaları (Dual Orbit Gyro Rings)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.08, 8, 24), ringMat);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.08, 8, 24), ringMat);
    ring2.rotation.x = Math.PI / 2;
    group.add(ring1, ring2);

    // Zemin Işık Projeksiyonu
    const haloGeo = new THREE.RingGeometry(0.6, 1.8, 16);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.9;
    group.add(halo);

    return group;
  }

  private createProjectileMesh(type: 'rocket' | 'oil'): THREE.Group {
    const group = new THREE.Group();

    if (type === 'rocket') {
      // Re-Volt Karikatürize Çizgili Havai Fişek Roketi
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6, roughness: 0.3 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 2.0, 14), bodyMat);
      body.rotation.x = Math.PI / 2;
      group.add(body);

      // Sarı Burun Konisi
      const noseMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xfacc15,
        emissiveIntensity: 0.5,
      });
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 14), noseMat);
      nose.rotation.x = Math.PI / 2;
      nose.position.z = 1.35;
      group.add(nose);

      // Kuyruk Kanatçıkları
      const finMat = new THREE.MeshStandardMaterial({ color: 0x18181b });
      const fin1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.45), finMat);
      fin1.position.z = -0.85;
      const fin2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.45), finMat);
      fin2.position.z = -0.85;
      group.add(fin1, fin2);
    } else {
      // Parlak Viskoz Yağ Birikintisi (Glossy Iridescent Oil Slick)
      const oilGeo = new THREE.CircleGeometry(1.6, 20);
      const oilMat = new THREE.MeshStandardMaterial({
        color: 0x09090b,
        metalness: 0.95,
        roughness: 0.08,
      });
      const oil = new THREE.Mesh(oilGeo, oilMat);
      oil.rotation.x = -Math.PI / 2;
      oil.position.y = 0.03;
      group.add(oil);

      // Yağ Yanar Döner Halka (Rainbow sheen ring)
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.1, 1.55, 16),
        new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.35 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.035;
      group.add(ring);
    }

    return group;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. 3D TABELA SPRITE (CANVAS BADGE)
  // ═══════════════════════════════════════════════════════════════════════════
  private updateNameSprite(carId: string, nickname: string, rank: number, colorHex: string) {
    let sprite = this.nameSprites.get(carId);
    if (!sprite) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;

      // Arka plan hap kutusu
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = colorHex || '#38bdf8';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(8, 8, 240, 48, 14);
      ctx.fill();
      ctx.stroke();

      // Sıra dairesi
      ctx.fillStyle = rank === 1 ? '#facc15' : colorHex || '#38bdf8';
      ctx.beginPath();
      ctx.arc(38, 32, 17, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.font = '900 19px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${rank}`, 38, 33);

      // Oyuncu adı
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 21px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(nickname.slice(0, 10).toUpperCase(), 66, 33);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
      sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(3.2, 0.8, 1);
      sprite.position.set(0, 2.55, 0);

      const carGroup = this.carMeshes.get(carId);
      if (carGroup) carGroup.add(sprite);
      this.nameSprites.set(carId, sprite);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. 30Hz SNAPSHOT DİNLEYİCİSİ & KAMERA TAKİBİ
  // ═══════════════════════════════════════════════════════════════════════════
  public updateSnapshot(snapshot: RcRushSnapshot) {
    this.latestSnapshot = snapshot;

    // Start Gantry Işıklarını Güncelle (3 Kırmızı -> 1 Yeşil)
    if (this.gantryLights.length === 4) {
      if (snapshot.phase === 'countdown') {
        const count = snapshot.countdown;
        // count: 3 ise 1. lamba yanar, 2 ise 2. lamba, 1 ise 3. lamba
        this.gantryLights[0].visible = true;
        (this.gantryLights[0].material as THREE.MeshStandardMaterial).emissiveIntensity = count <= 3 ? 1.8 : 0.2;
        (this.gantryLights[1].material as THREE.MeshStandardMaterial).emissiveIntensity = count <= 2 ? 1.8 : 0.2;
        (this.gantryLights[2].material as THREE.MeshStandardMaterial).emissiveIntensity = count <= 1 ? 1.8 : 0.2;
        (this.gantryLights[3].material as THREE.MeshStandardMaterial).emissiveIntensity = 0.1;
      } else {
        // Yarış başladı: Kırmızılar söner, yeşil lamba parlar
        this.gantryLights[0].visible = false;
        this.gantryLights[1].visible = false;
        this.gantryLights[2].visible = false;
        (this.gantryLights[3].material as THREE.MeshStandardMaterial).emissiveIntensity = 2.5;
      }
    }

    // 1. Arabalar
    snapshot.cars.forEach((car) => {
      let carGroup = this.carMeshes.get(car.id);
      if (!carGroup) {
        carGroup = this.createCarMesh(car);
        this.carMeshes.set(car.id, carGroup);
        this.scene.add(carGroup);
      }

      const existingTarget = this.interpolationTargets.get(car.id);
      const prevSpeed = existingTarget ? existingTarget.speed : car.speed;

      this.interpolationTargets.set(car.id, {
        x: car.x,
        y: car.y,
        z: car.z,
        rotation: car.rotation,
        roll: car.roll,
        speed: car.speed,
        prevSpeed,
        wheelSteer: car.wheelSteer,
        wheelRotation: car.wheelRotation,
        isBoosting: car.isBoosting,
        isDrifting: car.isDrifting,
        slipRatio: car.slipRatio || 0,
      });

      this.updateNameSprite(car.id, car.nickname, car.position, car.color);
    });

    // 2. Güç Kutuları
    snapshot.pickups.forEach((pu) => {
      let puMesh = this.pickupMeshes.get(pu.id);
      if (!puMesh) {
        puMesh = this.createPickupMesh();
        puMesh.position.set(pu.x, pu.y, pu.z);
        this.pickupMeshes.set(pu.id, puMesh);
        this.scene.add(puMesh);
      }
      puMesh.visible = pu.active;
      if (pu.active) {
        puMesh.rotation.y += 0.045;
        puMesh.rotation.x += 0.025;
      }
    });

    // 3. Mermiler (Roket & Yağ)
    const activeProjIds = new Set(snapshot.projectiles.map((p) => p.id));
    this.projectileMeshes.forEach((mesh, id) => {
      if (!activeProjIds.has(id)) {
        this.scene.remove(mesh);
        this.projectileMeshes.delete(id);
      }
    });

    snapshot.projectiles.forEach((proj) => {
      let projMesh = this.projectileMeshes.get(proj.id);
      if (!projMesh) {
        projMesh = this.createProjectileMesh(proj.type);
        this.projectileMeshes.set(proj.id, projMesh);
        this.scene.add(projMesh);
      }
      projMesh.position.set(proj.x, proj.y, proj.z);
      projMesh.rotation.y = proj.rotation;
    });

    // 4. Dinamik Kamera
    this.updateCamera(snapshot);
  }

  private updateCamera(snapshot: RcRushSnapshot) {
    if (snapshot.cars.length === 0) return;

    let targetCar = snapshot.cars.find((c) => c.id === this.focusedCarId);
    if (!targetCar) {
      targetCar = snapshot.cars.reduce((prev, curr) => (curr.position < prev.position ? curr : prev), snapshot.cars[0]);
    }

    if (!targetCar) return;

    // Yere yakın, 1:10 ölçek perspektifli Spring-Arm kamera
    const followDistance = 9.8;
    const followHeight = 4.6;
    const lookAheadDistance = 5.5;

    const camTargetX = targetCar.x - Math.sin(targetCar.rotation) * followDistance;
    const camTargetY = targetCar.y + followHeight;
    const camTargetZ = targetCar.z - Math.cos(targetCar.rotation) * followDistance;

    let shakeX = 0;
    let shakeY = 0;
    if (this.cameraShakeIntensity > 0) {
      shakeX = (Math.random() - 0.5) * this.cameraShakeIntensity;
      shakeY = (Math.random() - 0.5) * this.cameraShakeIntensity;
      this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - 0.08);
    }

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, camTargetX + shakeX, 0.16);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, camTargetY + shakeY, 0.16);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, camTargetZ, 0.16);

    const lookTarget = new THREE.Vector3(
      targetCar.x + Math.sin(targetCar.rotation) * lookAheadDistance,
      targetCar.y + 1.15,
      targetCar.z + Math.cos(targetCar.rotation) * lookAheadDistance
    );
    this.camera.lookAt(lookTarget);

    // Hıza göre dinamik FOV genişlemesi (62° -> 78°)
    const speedRatio = Math.min(1.0, targetCar.speed / 140);
    this.targetCameraFov = 62 + speedRatio * 16;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.targetCameraFov, 0.08);
    this.camera.updateProjectionMatrix();
  }

  private emitExhaustParticles(pos: THREE.Vector3, rotation: number, isBoost: boolean) {
    const count = isBoost ? 7 : 2;
    for (let c = 0; c < count; c++) {
      const idx = Math.floor(Math.random() * this.maxParticles);
      const i3 = idx * 3;

      const backX = pos.x - Math.sin(rotation) * 1.8 + (Math.random() - 0.5) * 0.45;
      const backZ = pos.z - Math.cos(rotation) * 1.8 + (Math.random() - 0.5) * 0.45;

      this.particlePositions[i3] = backX;
      this.particlePositions[i3 + 1] = 0.38 + Math.random() * 0.2;
      this.particlePositions[i3 + 2] = backZ;

      const speed = isBoost ? 14 : 5.5;
      this.particleVelocities[i3] = -Math.sin(rotation) * speed + (Math.random() - 0.5) * 2;
      this.particleVelocities[i3 + 1] = 1.0 + Math.random() * 2.2;
      this.particleVelocities[i3 + 2] = -Math.cos(rotation) * speed + (Math.random() - 0.5) * 2;

      this.particleLifetimes[idx] = isBoost ? 0.38 : 0.25;

      // Renk: Nitro için alev mavisi ve sarı-turuncu; normal için açık duman
      if (isBoost) {
        if (Math.random() > 0.4) {
          this.particleColors[i3] = 0.22;
          this.particleColors[i3 + 1] = 0.74;
          this.particleColors[i3 + 2] = 0.97;
        } else {
          this.particleColors[i3] = 0.98;
          this.particleColors[i3 + 1] = 0.55;
          this.particleColors[i3 + 2] = 0.12;
        }
      } else {
        this.particleColors[i3] = 0.65;
        this.particleColors[i3 + 1] = 0.7;
        this.particleColors[i3 + 2] = 0.75;
      }
    }
  }

  public handleRaceEvent(event: RaceEvent) {
    if (event.type === 'ROCKET_HIT' || event.type === 'OIL_SLIP') {
      this.cameraShakeIntensity = 1.35;
    } else if (event.type === 'BOOST') {
      this.cameraShakeIntensity = 0.45;
    } else if (event.type === 'CRASH') {
      this.cameraShakeIntensity = 0.85;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. 60-144 FPS KESİNTİSİZ RENDER DÖNGÜSÜ
  // ═══════════════════════════════════════════════════════════════════════════
  private startLoop() {
    const loop = () => {
      this.animFrameId = requestAnimationFrame(loop);
      const dt = 0.016;

      // 1. İstemci Tarafı Araç İnterpolasyonu & Şasi / Anten Fiziği
      this.interpolationTargets.forEach((target, carId) => {
        const carGroup = this.carMeshes.get(carId);
        if (!carGroup) return;

        // Pozisyon ve Yön Lerp
        carGroup.position.lerp(new THREE.Vector3(target.x, target.y, target.z), 0.28);
        carGroup.rotation.y = THREE.MathUtils.lerp(carGroup.rotation.y, target.rotation, 0.28);

        // Prosedürel Gövde Eğimi (BodyShell Pitch & Roll)
        const bodyShell = this.bodyShells.get(carId);
        if (bodyShell) {
          const accel = (target.speed - target.prevSpeed) / Math.max(0.001, dt);
          const targetPitch = THREE.MathUtils.clamp(-accel * 0.006, -0.12, 0.12);
          bodyShell.rotation.x = THREE.MathUtils.lerp(bodyShell.rotation.x, targetPitch, 0.16);
          bodyShell.rotation.z = THREE.MathUtils.lerp(bodyShell.rotation.z, target.roll, 0.2);
        }

        // Tekerlekler: Dönüş ve Direksiyon
        const wheels = this.wheelMeshes.get(carId);
        if (wheels && wheels.length === 4) {
          wheels[0].rotation.y = target.wheelSteer;
          wheels[0].rotation.x = target.wheelRotation;
          wheels[1].rotation.y = target.wheelSteer;
          wheels[1].rotation.x = target.wheelRotation;
          wheels[2].rotation.x = target.wheelRotation;
          wheels[3].rotation.x = target.wheelRotation;

          // Lastik İzi (Skidmarks)
          if (target.isDrifting || target.slipRatio > 0.28) {
            const leftTirePos = new THREE.Vector3();
            const rightTirePos = new THREE.Vector3();
            wheels[2].getWorldPosition(leftTirePos);
            wheels[3].getWorldPosition(rightTirePos);

            const lastPts = this.lastTirePoints.get(carId);
            if (lastPts) {
              const moveDist = leftTirePos.distanceTo(lastPts.left);
              if (moveDist > 0.5 && moveDist < 8.0) {
                this.addSkidQuad(lastPts.left, lastPts.right, leftTirePos, rightTirePos);
              }
            }
            this.lastTirePoints.set(carId, { left: leftTirePos.clone(), right: rightTirePos.clone() });
          } else {
            this.lastTirePoints.delete(carId);
          }
        }

        // Esnek Yaylı Anten Fiziği (Spring-Damper Oscillation)
        const antenna = this.antennaStates.get(carId);
        if (antenna) {
          const restX = 0.45;
          const restZ = -1.35;
          const k = 48;
          const damping = 0.88;

          const forceX = -target.wheelSteer * 1.6;
          const forceZ = (target.speed - target.prevSpeed) * 0.05;

          antenna.velX = (antenna.velX + (restX - antenna.tipLocalX + forceX) * k * dt) * damping;
          antenna.velZ = (antenna.velZ + (restZ - antenna.tipLocalZ + forceZ) * k * dt) * damping;

          antenna.tipLocalX += antenna.velX * dt;
          antenna.tipLocalZ += antenna.velZ * dt;

          antenna.tipMesh.position.set(antenna.tipLocalX, 2.85, antenna.tipLocalZ);

          const posAttr = antenna.mastLine.geometry.attributes.position as THREE.BufferAttribute;
          posAttr.setXYZ(1, (restX + antenna.tipLocalX) * 0.5, 1.85, (restZ + antenna.tipLocalZ) * 0.5);
          posAttr.setXYZ(2, antenna.tipLocalX, 2.85, antenna.tipLocalZ);
          posAttr.needsUpdate = true;
        }

        // Fren Lambalarını Parlat
        const taillights = this.carTaillights.get(carId);
        if (taillights) {
          const isBraking = target.speed < target.prevSpeed - 0.5;
          taillights.forEach((t) => {
            (t.material as THREE.MeshStandardMaterial).emissiveIntensity = isBraking ? 2.5 : 0.8;
          });
        }

        // Egzoz & Nitro Alev Parçacıkları
        if (target.isBoosting || target.isDrifting || target.speed > 5) {
          this.emitExhaustParticles(carGroup.position, target.rotation, target.isBoosting);
        }
      });

      // 2. Parçacıkları Güncelle
      for (let i = 0; i < this.maxParticles; i++) {
        if (this.particleLifetimes[i] > 0) {
          this.particleLifetimes[i] -= dt;
          const i3 = i * 3;
          this.particlePositions[i3] += this.particleVelocities[i3] * dt;
          this.particlePositions[i3 + 1] += this.particleVelocities[i3 + 1] * dt;
          this.particlePositions[i3 + 2] += this.particleVelocities[i3 + 2] * dt;
        } else {
          this.particlePositions[i * 3 + 1] = -100;
        }
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
      this.particles.geometry.attributes.color.needsUpdate = true;

      // 3. Ortam Toz Zerrecikleri Hareketi
      if (this.dustParticles) {
        const dustPos = this.dustParticles.geometry.attributes.position as THREE.BufferAttribute;
        for (let d = 0; d < this.maxDust; d++) {
          let dy = dustPos.getY(d) - 0.025;
          if (dy < 0.5) dy = 25;
          dustPos.setY(d, dy);
        }
        dustPos.needsUpdate = true;
      }

      // 4. Sahneyi Render Et
      this.renderer.render(this.scene, this.camera);
    };

    loop();
  }

  private onResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public setFocusedCar(carId: string) {
    this.focusedCarId = carId;
  }

  public dispose() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    if (this.container && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

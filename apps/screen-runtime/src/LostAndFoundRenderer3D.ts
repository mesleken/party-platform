import * as THREE from 'three';
import type { LostAndFoundSnapshot } from '@games/lost-and-found';

interface CharacterVisual {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  headMesh: THREE.Mesh;
  toolMesh: THREE.Mesh;
  beamLine?: THREE.Line;
  labelSprite?: THREE.Sprite;
  targetPos: THREE.Vector3;
  targetScale: THREE.Vector3;
  targetRotation: number;
}

export class LostAndFoundRenderer3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animFrameId?: number;

  private miloVisual?: CharacterVisual;
  private niaVisual?: CharacterVisual;
  private crateMeshes = new Map<string, THREE.Mesh>();
  private platformMeshes = new Map<string, THREE.Mesh>();
  private plateMeshes = new Map<string, THREE.Mesh>();
  private leverMeshes = new Map<string, THREE.Group>();
  private ringMeshes = new Map<string, THREE.Mesh>();

  private powerCoreMesh?: THREE.Mesh;
  private portalMesh?: THREE.Group;
  private miniGameHolo?: THREE.Group;

  // Camera tracking
  private cameraTarget = new THREE.Vector3(12, 8, 22);
  private cameraLookAt = new THREE.Vector3(12, 6, 0);

  // Materials cache
  private woodMat: THREE.MeshStandardMaterial;
  private metalMat: THREE.MeshStandardMaterial;
  private brassMat: THREE.MeshStandardMaterial;
  private glowCyanMat: THREE.MeshBasicMaterial;
  private glowGoldMat: THREE.MeshBasicMaterial;
  private glowGreenMat: THREE.MeshBasicMaterial;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene & Atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0d0f17');
    this.scene.fog = new THREE.FogExp2('#0d0f17', 0.015);

    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.5, 500);
    this.camera.position.set(12, 10, 24);

    // 2. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // 3. Materials
    this.woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8, metalness: 0.1 });
    this.metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.8 });
    this.brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.9 });
    this.glowCyanMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    this.glowGoldMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    this.glowGreenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });

    // 4. Lights
    this.setupLighting();

    // 5. Background Workshop Deco
    this.setupEnvironmentDecorations();

    // 6. Characters
    this.setupCharacters();

    // 7. Portal
    this.setupExitPortal();

    // 8. Holographic Terminal
    this.setupHoloTerminal();

    // 9. Resize & Render loop
    window.addEventListener('resize', this.onWindowResize);
    this.startRenderLoop();
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffecd2, 1.4);
    dirLight.position.set(30, 45, 25);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);

    const rimLight = new THREE.PointLight(0x38bdf8, 2, 40);
    rimLight.position.set(10, 15, -5);
    this.scene.add(rimLight);

    const warmLight = new THREE.PointLight(0xf59e0b, 2.5, 45);
    warmLight.position.set(80, 20, 5);
    this.scene.add(warmLight);
  }

  private setupEnvironmentDecorations(): void {
    // Back wall
    const wallGeo = new THREE.PlaneGeometry(160, 60);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e1e2d, roughness: 0.95 });
    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.position.set(60, 20, -5);
    this.scene.add(wallMesh);

    // Decorative Rotating Gears on Wall
    const gearGeo = new THREE.CylinderGeometry(4, 4, 0.5, 12);
    const gear1 = new THREE.Mesh(gearGeo, this.brassMat);
    gear1.rotation.x = Math.PI / 2;
    gear1.position.set(36, 16, -4.5);
    gear1.name = 'gear_1';
    this.scene.add(gear1);

    const gear2 = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.5, 8), this.metalMat);
    gear2.rotation.x = Math.PI / 2;
    gear2.position.set(42, 19, -4.3);
    gear2.name = 'gear_2';
    this.scene.add(gear2);
  }

  private setupCharacters(): void {
    // 1. MILO (Mavi / Atletik / Mıknatıs)
    const miloGroup = new THREE.Group();
    const miloBodyGeo = new THREE.CylinderGeometry(0.7, 0.6, 1.4, 16);
    const miloBodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
    const miloBody = new THREE.Mesh(miloBodyGeo, miloBodyMat);
    miloBody.position.y = 0.7;
    miloBody.castShadow = true;
    miloGroup.add(miloBody);

    const miloHeadGeo = new THREE.SphereGeometry(0.55, 16, 16);
    const miloHeadMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.6 });
    const miloHead = new THREE.Mesh(miloHeadGeo, miloHeadMat);
    miloHead.position.y = 1.7;
    miloGroup.add(miloHead);

    // Scarf
    const scarfGeo = new THREE.TorusGeometry(0.5, 0.15, 8, 16);
    const scarfMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe });
    const scarf = new THREE.Mesh(scarfGeo, scarfMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.35;
    miloGroup.add(scarf);

    // Magnet Glove on hand
    const magnetGeo = new THREE.TorusGeometry(0.3, 0.1, 8, 12, Math.PI);
    const magnet = new THREE.Mesh(magnetGeo, this.brassMat);
    magnet.position.set(0.9, 0.9, 0);
    magnet.rotation.z = -Math.PI / 2;
    miloGroup.add(magnet);

    // Milo Label
    const miloLabel = this.createTextSprite('MILO (Mıknatıs)', '#38bdf8');
    miloLabel.position.y = 2.6;
    miloGroup.add(miloLabel);

    this.scene.add(miloGroup);
    this.miloVisual = {
      group: miloGroup,
      bodyMesh: miloBody,
      headMesh: miloHead,
      toolMesh: magnet,
      labelSprite: miloLabel,
      targetPos: new THREE.Vector3(4, 2, 0),
      targetScale: new THREE.Vector3(1, 1, 1),
      targetRotation: 0,
    };

    // 2. NIA (Altın Sarısı / Mucit / Kanca)
    const niaGroup = new THREE.Group();
    const niaBodyGeo = new THREE.CylinderGeometry(0.65, 0.55, 1.3, 16);
    const niaBodyMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });
    const niaBody = new THREE.Mesh(niaBodyGeo, niaBodyMat);
    niaBody.position.y = 0.65;
    niaBody.castShadow = true;
    niaGroup.add(niaBody);

    const niaHeadGeo = new THREE.SphereGeometry(0.52, 16, 16);
    const niaHead = new THREE.Mesh(niaHeadGeo, miloHeadMat);
    niaHead.position.y = 1.6;
    niaGroup.add(niaHead);

    // Goggles
    const gogglesGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.5, 12);
    const gogglesMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 });
    const goggles = new THREE.Mesh(gogglesGeo, gogglesMat);
    goggles.rotation.z = Math.PI / 2;
    goggles.position.set(0, 1.7, 0.45);
    niaGroup.add(goggles);

    // Wrist Grapple Canister
    const grappleGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8);
    const grapple = new THREE.Mesh(grappleGeo, this.metalMat);
    grapple.position.set(-0.8, 0.8, 0);
    grapple.rotation.z = Math.PI / 4;
    niaGroup.add(grapple);

    // Nia Label
    const niaLabel = this.createTextSprite('NIA (Kanca)', '#facc15');
    niaLabel.position.y = 2.5;
    niaGroup.add(niaLabel);

    this.scene.add(niaGroup);
    this.niaVisual = {
      group: niaGroup,
      bodyMesh: niaBody,
      headMesh: niaHead,
      toolMesh: grapple,
      labelSprite: niaLabel,
      targetPos: new THREE.Vector3(8, 2, 0),
      targetScale: new THREE.Vector3(1, 1, 1),
      targetRotation: 0,
    };
  }

  private setupExitPortal(): void {
    this.portalMesh = new THREE.Group();

    // Portal arch
    const ringGeo = new THREE.TorusGeometry(3, 0.4, 16, 32);
    const ringMesh = new THREE.Mesh(ringGeo, this.brassMat);
    this.portalMesh.add(ringMesh);

    // Glowing vortex center
    const vortexGeo = new THREE.CircleGeometry(2.8, 32);
    const vortexMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    const vortex = new THREE.Mesh(vortexGeo, vortexMat);
    vortex.name = 'portal_vortex';
    this.portalMesh.add(vortex);

    this.portalMesh.position.set(112, 17, -0.5);
    this.scene.add(this.portalMesh);
  }

  private setupHoloTerminal(): void {
    this.miniGameHolo = new THREE.Group();

    // Central console pillar
    const pillarGeo = new THREE.CylinderGeometry(1.2, 1.5, 3, 16);
    const pillar = new THREE.Mesh(pillarGeo, this.metalMat);
    pillar.position.y = 1.5;
    this.miniGameHolo.add(pillar);

    // Holographic frequency rings
    const ring1Geo = new THREE.TorusGeometry(1.8, 0.08, 8, 32);
    const ring1 = new THREE.Mesh(ring1Geo, this.glowCyanMat);
    ring1.name = 'holo_ring_milo';
    ring1.position.y = 3.6;
    this.miniGameHolo.add(ring1);

    const ring2Geo = new THREE.TorusGeometry(1.4, 0.08, 8, 32);
    const ring2 = new THREE.Mesh(ring2Geo, this.glowGoldMat);
    ring2.name = 'holo_ring_nia';
    ring2.position.y = 3.6;
    this.miniGameHolo.add(ring2);

    this.miniGameHolo.position.set(96, 14, 0);
    this.scene.add(this.miniGameHolo);
  }

  private createTextSprite(text: string, color: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.roundRect(4, 4, 248, 56, 12);
    ctx.fill();

    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3.2, 0.8, 1);
    return sprite;
  }

  public updateSnapshot(state: LostAndFoundSnapshot): void {
    if (!state) return;

    // 1. Update Platforms
    for (const plat of state.platforms) {
      let mesh = this.platformMeshes.get(plat.id);
      if (!mesh) {
        let mat = this.woodMat;
        if (plat.type === 'moving_v') mat = this.brassMat;
        if (plat.type === 'piston' || plat.type === 'gate') mat = this.metalMat;

        const geo = new THREE.BoxGeometry(plat.width, plat.height, 3.5);
        mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        this.platformMeshes.set(plat.id, mesh);
      }

      // Position update (center of box)
      const targetY = plat.type === 'gate' && plat.isOpen ? plat.y + plat.height * 0.9 : plat.y;
      mesh.position.set(plat.x + plat.width / 2, targetY + plat.height / 2, 0);
    }

    // 2. Update Crates
    for (const crate of state.crates) {
      let mesh = this.crateMeshes.get(crate.id);
      if (!mesh) {
        const geo = new THREE.BoxGeometry(crate.width, crate.height, 2.5);
        const mat = crate.isMetal ? this.metalMat : this.woodMat;
        mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        this.crateMeshes.set(crate.id, mesh);
      }
      mesh.position.set(crate.x + crate.width / 2, crate.y + crate.height / 2, 0);
    }

    // 3. Update Pressure Plates
    for (const plate of state.pressurePlates) {
      let mesh = this.plateMeshes.get(plate.id);
      if (!mesh) {
        const geo = new THREE.BoxGeometry(plate.width, 0.35, 3);
        const mat = plate.isPressed ? this.glowGreenMat : this.glowGoldMat;
        mesh = new THREE.Mesh(geo, mat);
        this.scene.add(mesh);
        this.plateMeshes.set(plate.id, mesh);
      }
      mesh.material = plate.isPressed ? this.glowGreenMat : this.glowGoldMat;
      mesh.position.set(plate.x + plate.width / 2, plate.isPressed ? 14 : 14.15, 0);
    }

    // 4. Update Anchor Rings
    for (const ring of state.anchorRings) {
      let mesh = this.ringMeshes.get(ring.id);
      if (!mesh) {
        const geo = new THREE.TorusGeometry(0.7, 0.15, 8, 16);
        mesh = new THREE.Mesh(geo, this.glowGoldMat);
        mesh.position.set(ring.x, ring.y, 0);
        this.scene.add(mesh);
        this.ringMeshes.set(ring.id, mesh);
      }
    }

    // 4.5. Update Levers
    for (const lever of state.levers) {
      let group = this.leverMeshes.get(lever.id);
      if (!group) {
        group = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.8), this.metalMat);
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2), this.brassMat);
        handle.name = 'handle';
        handle.position.y = 0.6;
        group.add(base);
        group.add(handle);
        this.scene.add(group);
        this.leverMeshes.set(lever.id, group);
      }
      group.position.set(lever.x, lever.y, 0);
      const handle = group.getObjectByName('handle');
      if (handle) {
        handle.rotation.z = lever.isOn ? -0.4 : 0.4;
      }
    }

    // 5. Update Power Core
    if (state.powerCore) {
      if (!this.powerCoreMesh) {
        const geo = new THREE.OctahedronGeometry(0.8);
        this.powerCoreMesh = new THREE.Mesh(geo, this.glowCyanMat);
        this.scene.add(this.powerCoreMesh);
      }
      this.powerCoreMesh.position.set(state.powerCore.x, state.powerCore.y, 0);
      this.powerCoreMesh.rotation.y += 0.04;
      this.powerCoreMesh.rotation.x += 0.02;
    }

    // 6. Update Players
    for (const p of state.players) {
      const visual = p.role === 'milo' ? this.miloVisual : this.niaVisual;
      if (!visual) continue;

      visual.targetPos.set(p.x, p.y, 0);
      visual.targetRotation = p.facingRight ? 0 : Math.PI;

      // Jump stretch / ground squash effect
      if (!p.isGrounded && Math.abs(p.vy) > 2) {
        visual.targetScale.set(0.85, 1.25, 0.85);
      } else {
        visual.targetScale.set(1, 1, 1);
      }

      // Ability Beam / Grapple Tether
      if (p.abilityActive && p.abilityTarget) {
        if (!visual.beamLine) {
          const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, 1, 0),
          ]);
          const lineMat = new THREE.LineBasicMaterial({
            color: p.role === 'milo' ? 0x38bdf8 : 0xfacc15,
            linewidth: 3,
          });
          visual.beamLine = new THREE.Line(lineGeo, lineMat);
          this.scene.add(visual.beamLine);
        }

        const positions = (visual.beamLine.geometry as THREE.BufferGeometry).attributes.position;
        positions.setXYZ(0, p.x, p.y + 1, 0);
        positions.setXYZ(1, p.abilityTarget.x, p.abilityTarget.y, 0);
        positions.needsUpdate = true;
        visual.beamLine.visible = true;
      } else if (visual.beamLine) {
        visual.beamLine.visible = false;
      }
    }

    // 7. Update Holographic Mini-Game
    if (this.miniGameHolo) {
      const ringMilo = this.miniGameHolo.getObjectByName('holo_ring_milo');
      const ringNia = this.miniGameHolo.getObjectByName('holo_ring_nia');

      if (ringMilo) {
        ringMilo.rotation.z = (state.miniGame.miloFrequency / 100) * Math.PI * 2;
      }
      if (ringNia) {
        ringNia.rotation.x = (state.miniGame.niaPhase * Math.PI) / 180;
      }
    }

    // 8. Dynamic Camera Positioning (Center of Milo & Nia with Zoom)
    const miloP = state.players.find((p) => p.role === 'milo');
    const niaP = state.players.find((p) => p.role === 'nia');

    if (miloP && niaP) {
      const midX = (miloP.x + niaP.x) / 2;
      const midY = (miloP.y + niaP.y) / 2 + 2.5;
      const dist = Math.hypot(miloP.x - niaP.x, miloP.y - niaP.y);

      // Distance zoom
      const targetZ = Math.max(16, Math.min(32, dist * 0.85 + 13));

      this.cameraTarget.set(midX, midY + 1.5, targetZ);
      this.cameraLookAt.set(midX, midY, 0);
    } else if (miloP || niaP) {
      const single = miloP || niaP!;
      this.cameraTarget.set(single.x, single.y + 3.5, 18);
      this.cameraLookAt.set(single.x, single.y + 2, 0);
    }
  }

  private startRenderLoop(): void {
    const clock = new THREE.Clock();

    const animate = () => {
      this.animFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Smooth camera lerp
      this.camera.position.lerp(this.cameraTarget, 0.08);
      this.camera.lookAt(this.cameraLookAt);

      // Character positions smooth interpolation & bobbing
      [this.miloVisual, this.niaVisual].forEach((visual) => {
        if (!visual) return;
        visual.group.position.lerp(visual.targetPos, 0.22);
        visual.group.scale.lerp(visual.targetScale, 0.15);
        visual.group.rotation.y = THREE.MathUtils.lerp(visual.group.rotation.y, visual.targetRotation, 0.2);

        // Idle breathing bob
        visual.headMesh.position.y = 1.65 + Math.sin(time * 3) * 0.03;
      });

      // Animated Background Gears
      const gear1 = this.scene.getObjectByName('gear_1');
      if (gear1) gear1.rotation.z += delta * 0.6;
      const gear2 = this.scene.getObjectByName('gear_2');
      if (gear2) gear2.rotation.z -= delta * 0.9;

      // Portal vortex pulse
      const vortex = this.scene.getObjectByName('portal_vortex');
      if (vortex) {
        vortex.rotation.z += delta * 1.5;
        const scale = 1 + Math.sin(time * 4) * 0.06;
        vortex.scale.set(scale, scale, 1);
      }

      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  private onWindowResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public destroy(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.onWindowResize);
    this.renderer.dispose();
  }
}

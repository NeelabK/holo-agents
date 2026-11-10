THREE.VolumetericLightShader = {
    uniforms: {
      tDiffuse: { value: null },
      lightPosition: { value: new THREE.Vector2(0.5, 0.5) },
      exposure: { value: 1 },
      decay: { value: 1 },
      density: { value: 0 },
      weight: { value: 0.1 },
      samples: { value: 3 }
    },
  
    vertexShader: [
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}"
    ].join("\n"),
  
    fragmentShader: [
      "varying vec2 vUv;",
      "uniform sampler2D tDiffuse;",
      "uniform vec2 lightPosition;",
      "uniform float exposure;",
      "uniform float decay;",
      "uniform float density;",
      "uniform float weight;",
      "uniform int samples;",
      "const int MAX_SAMPLES = 100;",
      "void main() {",
      "  vec2 texCoord = vUv;",
      "  vec2 deltaTextCoord = texCoord - lightPosition;",
      "  deltaTextCoord *= 1.0 / float(samples) * density;",
      "  vec4 color = texture2D(tDiffuse, texCoord);",
      "  float illuminationDecay = 1.0;",
      "  for(int i=0; i < MAX_SAMPLES; i++) {",
      "    if(i == samples) {",
      "      break;",
      "    }",
      "    texCoord += deltaTextCoord;",
      "    vec4 sample = texture2D(tDiffuse, texCoord);",
      "    sample *= illuminationDecay * weight;",
      "    color += sample;",
      "    illuminationDecay *= decay;",
      "  }",
      "  gl_FragColor = color * exposure;",
      "}"
    ].join("\n")
  };
  
  THREE.AdditiveBlendingShader = {
    uniforms: {
      tDiffuse: { value: null },
      tAdd: { value: null }
    },
  
    vertexShader: [
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}"
    ].join("\n"),
  
    fragmentShader: [
      "uniform sampler2D tDiffuse;",
      "uniform sampler2D tAdd;",
      "varying vec2 vUv;",
      "void main() {",
      "  vec4 color = texture2D(tDiffuse, vUv);",
      "  vec4 add = texture2D(tAdd, vUv);",
      "  vec3 blendedColor = color.rgb + add.rgb;",
      "  float blendedAlpha = max(color.a, add.a);",
      "  gl_FragColor = vec4(blendedColor, blendedAlpha);",
      "}"
    ].join("\n")
  };
  
  THREE.PassThroughShader = {
    uniforms: {
      tDiffuse: { value: null }
    },
  
    vertexShader: [
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}"
    ].join("\n"),
  
    fragmentShader: [
      "uniform sampler2D tDiffuse;",
      "varying vec2 vUv;",
      "void main() {",
      "  gl_FragColor = texture2D(tDiffuse, vUv);",
      "}"
    ].join("\n")
  };
  
  THREE.BlackKeyShader = {
    uniforms: {
      tDiffuse: { value: null },
      threshold: { value: 0.05 },
      thresholdEnd: { value: 0.15 }
    },
    vertexShader: [
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}"
    ].join("\n"),
  
    fragmentShader: [
      "uniform sampler2D tDiffuse;",
      "uniform float threshold;",
      "uniform float thresholdEnd;",
      "varying vec2 vUv;",
      "void main() {",
      "  vec4 color = texture2D(tDiffuse, vUv);",
      "  float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));",
      "  float alpha = smoothstep(threshold, thresholdEnd, brightness);",
      "  alpha = pow(alpha, 0.5);",
      "  gl_FragColor = vec4(color.rgb, alpha);",
      "}"
    ].join("\n")
  };
  
  class Hologram {
    constructor(containerId, videoSrc) {
      this.width = 300;
      this.height = 350;
      this.lightColor = 0x00baff;
      this.DEFAULT_LAYER = 0;
      this.OCCLUSION_LAYER = 1;
      this.renderScale = 1;
      this.clock = new THREE.Clock();
      
      this.composer = null;
      this.filmPass = null;
      this.badTVPass = null;
      this.bloomPass = null;
      this.occlusionComposer = null;
      this.itemMesh = null;
      this.occMesh = null;
      this.occRenderTarget = null;
      this.lightSource = null;
      this.vlShaderUniforms = null;
      this.blackKeyPass = null;
      
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
      
      this.renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        premultipliedAlpha: false
      });
      
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.setSize(this.width, this.height);
      
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`Container element with id '${containerId}' not found`);
      }
      container.appendChild(this.renderer.domElement);
      
      this.isActive = true;
      this.videoElement = null;
      
      this.isPaused = false;
      this.frameCount = 0;
      this.initialFrames = 2;
      
      this.setupScene(videoSrc);
      this.setupPostprocessing();
      this.onFrame();
    }

    destroy() {
      this.isActive = false;
      
      // Stop video playback and clear source
      if (this.videoElement) {
        this.videoElement.pause();
        this.videoElement.src = '';
        this.videoElement.load();
        this.videoElement.remove();
      }

      // Stop animation frame
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }

      // Dispose of Three.js resources
      if (this.composer) {
        this.composer.dispose();
      }
      if (this.occlusionComposer) {
        this.occlusionComposer.dispose();
      }
      if (this.renderer) {
        this.renderer.dispose();
        this.renderer.forceContextLoss();
        this.renderer.domElement.remove();
      }
      
      // Clear scene
      if (this.scene) {
        this.scene.traverse(object => {
          if (object.material) {
            object.material.dispose();
          }
          if (object.geometry) {
            object.geometry.dispose();
          }
        });
        this.scene.clear();
      }

      // Clear the container
      const container = document.getElementById(this.containerId);
      if (container) {
        container.innerHTML = '';
      }
    }

    setupScene(videoSrc) {
      this.lightSource = new THREE.Object3D();
      this.lightSource.position.set(0, -15, -15);
    
      const itemGeo = new THREE.PlaneGeometry(9, 8);
      const itemMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7 });
    
      const video = document.createElement('video');
      this.videoElement = video;
      video.crossOrigin = 'Anonymous';
      video.loop = true;
      video.playsInline = true;
      video.muted = true;
      video.volume = 1.0;
    
      // Create video texture
      const videoTexture = new THREE.VideoTexture(video);
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;
      videoTexture.format = THREE.RGBAFormat;
    
      itemMaterial.map = videoTexture;
      itemMaterial.needsUpdate = true;
    
      const occItemMaterial = new THREE.MeshBasicMaterial({ color: this.lightColor });
      occItemMaterial.map = videoTexture;
      occItemMaterial.needsUpdate = true;
    
      this.itemMesh = new THREE.Mesh(itemGeo, itemMaterial);
      this.scene.add(this.itemMesh);
    
      this.occMesh = new THREE.Mesh(itemGeo, occItemMaterial);
      this.occMesh.layers.set(this.OCCLUSION_LAYER);
      this.scene.add(this.occMesh);
    
      // Load and play video
      video.src = videoSrc;
      video.load();
      video.play().catch(e => {
        console.log("Video autoplay prevented:", e);
      });

      // Handle mobile responsiveness
      setInterval(() => {
        if (window.innerWidth < 768) {
          this.camera.position.z = 6.7;
        } else {
          this.camera.position.z = 5;
        }
      }, 1000);
    }

    setupPostprocessing() {
      this.occRenderTarget = new THREE.WebGLRenderTarget(this.width * this.renderScale, this.height * this.renderScale, {
        format: THREE.RGBAFormat,
        transparent: true,
        alpha: true,
        premultipliedAlpha: false
      });
    
      const hBlur = new THREE.ShaderPass(THREE.HorizontalBlurShader);
      const vBlur = new THREE.ShaderPass(THREE.VerticalBlurShader);
      const bluriness = 7;
      hBlur.uniforms.h.value = bluriness / this.width;
      vBlur.uniforms.v.value = bluriness / this.height;
    
      this.badTVPass = new THREE.ShaderPass(THREE.BadTVShader);
      this.badTVPass.uniforms.distortion.value = 1.7;
      this.badTVPass.uniforms.distortion2.value = 2.7;
      this.badTVPass.uniforms.speed.value = 0.25;
      this.badTVPass.uniforms.rollSpeed.value = 0;
    
      const vlPass = new THREE.ShaderPass(THREE.VolumetericLightShader);
      this.vlShaderUniforms = vlPass.uniforms;
      vlPass.needsSwap = false;
    
      this.occlusionComposer = new THREE.EffectComposer(this.renderer, this.occRenderTarget);
      this.occlusionComposer.addPass(new THREE.RenderPass(this.scene, this.camera));
      this.occlusionComposer.addPass(hBlur);
      this.occlusionComposer.addPass(vBlur);
      this.occlusionComposer.addPass(hBlur);
      this.occlusionComposer.addPass(vBlur);
      this.occlusionComposer.addPass(hBlur);
      this.occlusionComposer.addPass(this.badTVPass);
      this.occlusionComposer.addPass(vlPass);
    
      this.bloomPass = new THREE.UnrealBloomPass(this.width / this.height, 2.5, 2.8, 3.3);
    
      this.filmPass = new THREE.ShaderPass(THREE.FilmShader);
      this.filmPass.uniforms.sCount.value = 1200;
      this.filmPass.uniforms.grayscale.value = false;
      this.filmPass.uniforms.sIntensity.value = 1.5;
      this.filmPass.uniforms.nIntensity.value = 0.2;
    
      const blendPass = new THREE.ShaderPass(THREE.AdditiveBlendingShader);
      blendPass.uniforms.tAdd.value = this.occRenderTarget.texture;
      blendPass.renderToScreen = false;
    
      this.blackKeyPass = new THREE.ShaderPass(THREE.BlackKeyShader);
      this.blackKeyPass.uniforms.threshold.value = 0.05;
      this.blackKeyPass.uniforms.thresholdEnd.value = 0.15;
      this.blackKeyPass.renderToScreen = true;
    
      const finalTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
        format: THREE.RGBAFormat,
        transparent: true,
        alpha: true,
        premultipliedAlpha: false
      });
    
      this.composer = new THREE.EffectComposer(this.renderer, finalTarget);
      this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(this.badTVPass);
      this.composer.addPass(this.filmPass);
      this.composer.addPass(blendPass);
      this.composer.addPass(this.blackKeyPass);
    }

    onFrame() {
      if (!this.isActive) return;
      requestAnimationFrame(() => this.onFrame());
      
      if (this.frameCount < this.initialFrames) {
        this.update();
        this.render();
        this.frameCount++;
        return;
      }
      
      if (!this.isPaused) {
        this.update();
        this.render();
      }
    }

    update() {
      const timeDelta = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();
    
      this.filmPass.uniforms.time.value += timeDelta;
      this.badTVPass.uniforms.time.value += 0.01;
    
      if (this.itemMesh && this.occMesh) {
        this.itemMesh.rotation.y = Math.sin(elapsed / 2) / 15;
        this.itemMesh.rotation.z = Math.cos(elapsed / 2) / 50;
        this.occMesh.rotation.copy(this.itemMesh.rotation);
    
        const p = this.lightSource.position.clone();
        const vector = p.project(this.camera);
        const x = (vector.x + 1) / 2;
        const y = (vector.y + 1) / 2;
        this.vlShaderUniforms.lightPosition.value.set(x, y);
      }
    }

    render() {
      this.camera.layers.set(this.OCCLUSION_LAYER);
      this.occlusionComposer.render();
    
      this.camera.layers.set(this.DEFAULT_LAYER);
      this.composer.render();
    }

    pause() {
      if (!this.isPaused) {
        this.isPaused = true;
        if (this.videoElement) {
          this.videoElement.pause();
        }
      }
    }

    resume() {
      if (this.isPaused) {
        this.isPaused = false;
        if (this.videoElement) {
          this.videoElement.play();
        }
      }
    }
  }

  class HologramManager {
    constructor() {
      this.currentHologram = null;
      this.videoSources = [
        'holos/steve-jobs.mp4',
        'holos/marcus-aurelius.mp4',
        'holos/rick-sanchez.mp4',
        'holos/hermione-granger.mp4',
        'holos/mrbeast.mp4'
      ];
    }

    initializeHologram() {
      if (!this.currentHologram) {
        const containerId = 'hologram-wrapper';
        const videoSrc = this.videoSources[0]; // Start with first video
        this.currentHologram = new Hologram(containerId, videoSrc);
      }
    }

    updateHologramPosition(slideElement) {
      if (!this.currentHologram) return;
      
      // Get the target wrapper in the slide
      const targetWrapper = slideElement.querySelector('.holowrapper');
      if (!targetWrapper) return;

      // Get the hologram container
      const hologramContainer = document.getElementById('hologram-wrapper');
      if (!hologramContainer) return;

      // Get the positions
      const wrapperRect = targetWrapper.getBoundingClientRect();
      const parentRect = document.querySelector('.div-block-5').getBoundingClientRect();

      // Calculate the relative position
      const relativeLeft = wrapperRect.left - parentRect.left;
      const relativeTop = wrapperRect.top - parentRect.top;

      // Update position using transform for better performance
      hologramContainer.style.transform = `translate(${relativeLeft}px, ${relativeTop}px)`;
    }

    updateHologramVideo(index) {
      if (!this.currentHologram) return;
      
      // Update video source
      const videoSrc = this.videoSources[index];
      if (this.currentHologram.videoElement) {
        this.currentHologram.videoElement.src = videoSrc;
        this.currentHologram.videoElement.load();
        this.currentHologram.videoElement.play().catch(e => {
          console.log("Video autoplay prevented:", e);
        });
      }
    }

    destroyHologram() {
      if (this.currentHologram) {
        this.currentHologram.destroy();
        this.currentHologram = null;
      }
    }
  }

  window.Hologram = Hologram;
  window.HologramManager = HologramManager;
  
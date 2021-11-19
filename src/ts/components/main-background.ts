import getMouse from 'ts/interaction/mouse'
import { mapclamp } from 'ts/lib/lib'
import Shader from 'ts/webgl/shader'
import Texture from 'ts/webgl/texture'

import vertexShaderSource1 from 'shaders/rain.vert'
import fragmentShaderSource1 from 'shaders/heatmap.frag'

import vertexShaderSource2 from 'shaders/rain.vert'
import fragmentShaderSource2 from 'shaders/rain.frag'

import bg from 'assets/img/bg.jpg'
import ScrollTimeline from 'ts/animation/scroll-pager'

class Animation {
  cnv: HTMLCanvasElement = null
  gl: WebGL2RenderingContext = null
  size = { w: 0, h: 0, cx: 0, cy: 0 }

  lastFrameTime = 0
  currentFrameTime = 0
  fps = 60
  fpsHistory = []

  proj = []

  psize = 4.0
  startTime = 0.0
  time = 0.0
  texture = null
  texture2 = null
  texture3 = null

  uvmouse = {
    x: 0.0,
    y: 0.0,
  }
  lastmousepos = {
    x: 0.0,
    y: 0.0,
  }
  mouseintensity = 0.0
  mouseshift = 0.0
  element: HTMLDivElement | null = null
  heatmapShader
  rainShader
  resolution = 1
  targetTextureWidth = 0
  targetTextureHeight = 0
  frameBuffer: WebGLFramebuffer | null = null
  _scrollTimeline

  constructor(element: HTMLDivElement) {
    this.element = element
    this.createCanvas()
  }

  set scrollTimeline(value: ScrollTimeline) {
    this._scrollTimeline = value
  }

  calculateMVP(): void {
    const ratio = this.size.w / this.size.h

    const left = 0
    const right = 1

    const bottom = 1
    const top = 0

    const near = 0.0
    const far = 1.0

    // prettier-ignore
    this.proj = [
      2 / (right - left),                   0,                 0,  -(right + left) / (right - left),
                       0,  2 / (top - bottom),                 0,  -(top + bottom) / (top - bottom),
                       0,                   0,  2 / (far - near),      -(far + near) / (far - near),
                       0,                   0,                 0,                                 1,
    ];
  }

  createCanvas(): void {
    this.cnv = document.createElement(`canvas`)
    this.element.appendChild(this.cnv)
    this.cnv.id = 'canvas'

    const gl = (this.gl = this.cnv.getContext('webgl2'))

    this.setCanvasSize()
    window.addEventListener(`resize`, () => {
      this.setCanvasSize()
    })

    this.rainShader = new Shader(gl)
    this.rainShader.createProgram(vertexShaderSource2, fragmentShaderSource2)

    this.heatmapShader = new Shader(gl)
    this.heatmapShader.createProgram(vertexShaderSource1, fragmentShaderSource1)

    const vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)

    // prettier-ignore
    const positions = [
      -1.0, -1.0,
       1.0, -1.0,
       1.0,  1.0,
      -1.0,  1.0
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW)

    const indexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)

    // prettier-ignore
    const indices = [
      0, 1, 2,
      2, 3, 0
    ];

    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STATIC_DRAW
    )

    this.heatmapShader.useProgram()
    this.heatmapShader.setPositions('aPos')
    this.heatmapShader.addUniform('u_Sampler', '1i')
    this.heatmapShader.addUniform('u_Mouse', '2f')
    this.heatmapShader.addUniform('u_time', '1f')
    this.heatmapShader.addUniform('u_MVP', '4fv')
    this.heatmapShader.addUniform('u_asp', '1f')

    this.rainShader.useProgram()
    this.rainShader.setPositions('aPos')
    this.rainShader.addUniform('u_MVP', '4fv')
    this.rainShader.addUniform('u_time', '1f')
    this.rainShader.addUniform('u_Size', '1f')
    this.rainShader.addUniform('u_Sampler', '1i')
    this.rainShader.addUniform('u_SamplerH', '1i')
    this.rainShader.addUniform('u_Mouse', '2f')
    this.rainShader.addUniform('u_MouseInt', '1f')
    this.rainShader.addUniform('u_asp', '1f')
    this.rainShader.addUniform('u_mouseshift', '1f')
    this.rainShader.addUniform('u_xPos', '1f')

    this.startTime = Date.now()

    this.texture = new Texture(gl).fromUrl(bg)

    // TODO: should be 1 dimentional
    this.targetTextureWidth = this.size.w
    this.targetTextureHeight = this.size.h

    this.texture2 = new Texture(gl).empty(256, 256)
    this.texture3 = new Texture(gl).empty(256, 256)

    // Create and bind the framebuffer
    this.frameBuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer)

    // attach the texture as the first color attachment
    const attachmentPoint = gl.COLOR_ATTACHMENT0
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      attachmentPoint,
      gl.TEXTURE_2D,
      this.texture2,
      0
    )
  }

  updateCanvas(): void {
    this.time = (Date.now() - this.startTime) / 1000.0
    this.calculateMVP()
    this.getMouse()
    this.drawHeatMap()
    this.drawImage()
    this.swapTextures()
  }

  drawImage(): void {
    // TODO store max scroll value in timepline as well
    const scrollValue = this._scrollTimeline.scrollValue / 3

    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.rainShader.useProgram()

    console.log('scrollValue', scrollValue);

    this.rainShader.setUniform('u_MVP', this.proj)
    this.rainShader.setUniform('u_time', this.time)
    this.rainShader.setUniform('u_Size', this.psize)
    this.rainShader.setUniform('u_Mouse', this.uvmouse.x, this.uvmouse.y)
    this.rainShader.setUniform('u_MouseInt', this.mouseintensity)
    this.rainShader.setUniform('u_asp', this.size.w / this.size.h)
    this.rainShader.setUniform('u_mouseshift', this.mouseshift)
    this.rainShader.setUniform('u_xPos', scrollValue)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    this.rainShader.setUniform('u_Sampler', 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.texture2)
    this.rainShader.setUniform('u_SamplerH', 1)
    this.gl.viewport(0, 0, this.size.w, this.size.h)
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
  }

  drawHeatMap(): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture2)
    const attachmentPoint = gl.COLOR_ATTACHMENT0
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      attachmentPoint,
      gl.TEXTURE_2D,
      this.texture2,
      0
    )
    this.heatmapShader.useProgram()
    this.heatmapShader.setUniform('u_Mouse', this.uvmouse.x, this.uvmouse.y)
    this.heatmapShader.setUniform('u_time', this.time)
    this.heatmapShader.setUniform('u_MVP', this.proj)
    this.heatmapShader.setUniform('u_asp', this.size.w / this.size.h)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.texture3)
    this.heatmapShader.setUniform('u_Sampler', 1)
    gl.viewport(0, 0, this.targetTextureWidth / 4, this.targetTextureHeight / 4)
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  swapTextures(): void {
    const tmp = this.texture2
    this.texture2 = this.texture3
    this.texture3 = tmp
  }

  setCanvasSize(): void {
    const width = this.element.clientWidth
    const height = this.element.clientHeight
    this.cnv.style.width = `${width}px`
    this.cnv.style.height = `${height}px`
    this.size.w = this.cnv.width = width / this.resolution
    this.size.h = this.cnv.height = height / this.resolution
    this.size.cx = this.size.w / 2
    this.size.cy = this.size.h / 2
    this.gl.viewport(0, 0, this.size.w, this.size.h)
  }

  getMouse(): void {
    const mouse = getMouse()
    const x = mouse.x
    const y = mouse.y
    // TODO: tweak
    if (x > 0 && x < this.size.w && y > 0 && y < this.size.h) {
      this.uvmouse = {
        x: mapclamp(x, 0, this.size.w, 0, 1),
        y: mapclamp(y, 0, this.size.h, 0, 1),
      }
      this.mouseshift = mapclamp(
        x - this.size.cx,
        -this.size.w / 3,
        this.size.w / 3,
        -0.05,
        0.05
      )
      return
    }
    this.uvmouse = {
      x: -1,
      y: -1,
    }
    this.mouseshift = 0
  }

  calculateFps(): void {
    if (this.lastFrameTime == 0) {
      this.lastFrameTime = this.time
    } else {
      this.currentFrameTime = this.time - this.lastFrameTime
      this.fpsHistory.push(1 / this.currentFrameTime)
      this.lastFrameTime = this.time
      if (this.fpsHistory.length > 20) {
        const sum = this.fpsHistory.reduce((a, b) => a + b, 0)
        const avg = sum / this.fpsHistory.length || 0
        this.fps = avg
        this.fpsHistory = []
        // console.log("Animation fps ", Math.round(this.fps, 0));
      }
    }
  }


  // animation loop
  animate(): void {
    this.updateCanvas()
    // this.calculateFps()

    window.requestAnimationFrame(() => {
      this.animate()
    })
  }
}

export default Animation

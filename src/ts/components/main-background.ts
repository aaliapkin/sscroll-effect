import squareVert from 'shaders/square.vert'
import gyroidFrag from 'shaders/raymarch-reflections3.frag'

import scroller2 from 'ts/animation/scroller2'

import RendererTexture from 'ts/renderers/renderer-tex'

import posX01 from 'assets/Yokohama3/posx.jpg'
import negX01 from 'assets/Yokohama3/negx.jpg'
import posY01 from 'assets/Yokohama3/posy.jpg'
import negY01 from 'assets/Yokohama3/negy.jpg'
import posZ01 from 'assets/Yokohama3/posz.jpg'
import negZ01 from 'assets/Yokohama3/negz.jpg'
import { mapclamp } from 'ts/lib/lib'

let renderer

let mouseStartX = 0
let mouseStartY = 0

let shiftX = 0
let shiftY = 0

let mouseDown = false

const handleMouseDown = (e) => {
  mouseStartX = e.x
  mouseStartY = e.y
  mouseDown = true
}

const handleMouseMove = (e) => {
  if (!mouseStartX && !mouseStartY) {
    return
  }

  const deltaX = e.x - mouseStartX
  const deltaY = e.y - mouseStartY

  shiftX = deltaX
  shiftY = deltaY
}

const handleMouseUp = (e) => {
  mouseStartX = 0
  mouseStartY = 0
  mouseDown = false
}

const update = function () {
  if (!renderer) {
    return
  }

  const scrollValue = scroller2.getScrollValue()
  renderer.setUniform('u_yRot', scrollValue / 1800)

  if (!mouseDown) {
    shiftX *= 0.9
    shiftY *= 0.9
  }

  renderer.setUniform('u_mouseX', shiftX * 0.001)
  renderer.setUniform('u_mouseY', shiftY * 0.0004)

  renderer.parameters['dim'] = mapclamp(scrollValue, 0, 1600, 0, 1)
  renderer.update()

  requestAnimationFrame(update)
}

const init = function (canvasContainer) {
  const shaderOptions = {
    name: 'Shiny gyroid',
    description: 'Cubemap sampling techniques',
    vertexSource: squareVert,
    fragmentSource: gyroidFrag,
    type: 'tex',
    parameters: [
      { id: 'gyrdens1', label: 'Gyroid density', default: 0.5 },
      { id: 'thick', label: 'Thickness', default: 0.3 },
      { id: 'vignette', label: 'Vignette', default: 1.0 },
      { id: 'dim', label: 'Dim', default: 0.0 },
    ],
    textureCube: {
      src: {
        posX: posX01,
        negX: negX01,
        posY: posY01,
        negY: negY01,
        posZ: posZ01,
        negZ: negZ01,
      },
    },
  }

  renderer = new RendererTexture(canvasContainer, shaderOptions)
  renderer.init()
  renderer.addUniform('yRot', '1f')

  renderer.canvas.addEventListener('mousedown', handleMouseDown)
  renderer.canvas.addEventListener('mousemove', handleMouseMove)
  renderer.canvas.addEventListener('mouseup', handleMouseUp)
  renderer.canvas.addEventListener('mouseout', handleMouseUp)

  update()
}

export default {
  init,
}

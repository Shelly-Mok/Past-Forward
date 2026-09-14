const skins = new Map<string, string>()
/** Small Canvas UI textures keep the outline on a true pixel grid at every viewport. */
export function memoryCloudSkin(kind: string) {
  const cache = skins.get(kind)
  if (cache) return cache
  const canvas = document.createElement('canvas')
  canvas.width = 150
  canvas.height = 100
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  const burst = kind === 'choice' || kind === 'summary'
  ctx.beginPath()
  const samples = burst ? 28 : 180
  for (let i = 0; i <= samples; i++) {
    const angle = i / samples * Math.PI * 2
    const radius = burst ? (i % 2 ? .77 : 1) : .86 + .075 * Math.cos(angle * 7)
    const x = Math.round(75 + Math.cos(angle) * 70 * radius)
    const y = Math.round(50 + Math.sin(angle) * 43 * radius)
    if (!i) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  if (!burst) {
    ctx.beginPath()
    ;[[75, 49, 53, 27], [42, 37, 23, 20], [74, 29, 25, 18], [108, 38, 24, 20], [122, 55, 19, 18], [94, 69, 26, 18], [55, 71, 26, 18], [29, 57, 23, 20]].forEach(([x, y, rx, ry]) => {
      ctx.moveTo(x + rx, y)
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
    })
  }
  ctx.fillStyle = '#fff'
  ctx.fill()
  const mask = ctx.getImageData(0, 0, 150, 100)
  const pixels = ctx.createImageData(150, 100)
  const gold = kind === 'start' || kind === 'summary'
  for (let y = 1; y < 99; y++) {
    for (let x = 1; x < 149; x++) {
      const pos = (y * 150 + x) * 4
      if (mask.data[pos + 3] < 128) continue
      const edge = [-1, 1, -150, 150].some(offset => mask.data[pos + offset * 4 + 3] < 128)
      pixels.data.set(edge ? (gold ? [244, 223, 172, 255] : [220, 239, 242, 255]) : [2, 5, 10, 225], pos)
    }
  }
  ctx.clearRect(0, 0, 150, 100)
  ctx.putImageData(pixels, 0, 0)
  /* The outline above is quantised once; CSS scales the cached bitmap with nearest-neighbour pixels. */
  if (!burst) {
    ctx.fillStyle = '#cee6eb'
    ;[[12, 13], [134, 19], [36, 91]].forEach(([x, y]) => {
      ctx.fillRect(x, y, 2, 2)
      ctx.fillRect(x - 2, y - 3, 2, 3)
    })
  }
  const url = `url("${canvas.toDataURL()}")`
  skins.set(kind, url)
  return url
}

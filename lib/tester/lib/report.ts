export const reStep = / (\d+)(.(\d+))? /

export const byStep = (a, b) => {
  const [_a0, a1 = null, _a2, a3 = null] = (a.match(reStep)||[]).map(Number)
  const [_b0, b1 = null, _b2, b3 = null] = (b.match(reStep)||[]).map(Number)
  const result = (a1 > b1) ? 1 : (a1 < b1) ? -1 : (a3 > b3) ? 1 : (a3 < b3) ? -1 : -1
  return result
}

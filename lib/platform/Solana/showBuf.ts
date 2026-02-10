function showBuffer (buffer) {
  return fields([...buffer]
    .map(x=>toHex(x))
    .reduce(grouped, [])
    .map(group=>group.join(' ')))
}


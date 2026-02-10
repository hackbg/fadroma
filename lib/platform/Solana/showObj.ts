function showObject (object) {
  return fields(Object.entries(object)
    .map(([x,y])=>`· ${x.padEnd(20)} \n     ${
      (y instanceof Buffer) ? showBuffer(y) :
      JSON.stringify(y)}`))
}


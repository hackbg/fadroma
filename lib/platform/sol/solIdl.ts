function findInIdl (program, name: string) {
  const rawName = Case.snake(name)
  return (program as any)._rawIdl.instructions.find(ix=>ix.name===rawName)
}

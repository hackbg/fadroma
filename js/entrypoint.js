process.on('unhandledRejection', up => {throw up})
module.exports = function entrypoint (_module, main) {
  return _module.exports = (require.main && require.main!==_module) ? main : main()
}

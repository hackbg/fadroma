export default function load (module, onLoad = defaultOnLoad, onError = defaultOnError) {
  return module.then(onLoad).catch(onError)
}
export function defaultOnLoad ({ "default": main }) {
  return main()
}
export function defaultOnError (e) {
  console.error(e);
  const stack = Object.assign(document.createElement('pre'), { innerText: e.stack });
  document.getElementById('editors').innerText = '';
  document.getElementById('editors').appendChild(stack);
}

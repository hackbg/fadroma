export default Icon;

function Icon (name: string) {
  return ['svg.icon', [`use[href=icons.svg#${name}]`]]
}

namespace Icon {
  // preset icons
}

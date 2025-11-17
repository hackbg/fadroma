const elById  = (id: string) => document.getElementById(id);

export async function loadDocs (html: string) {
  const main = elById("main");
  const sect = new DocumentFragment();
  const docs = new DOMParser().parseFromString(html, 'text/html');
  docs.querySelectorAll(".namespaceSection").forEach(loadSection);
  main.innerHTML = '';
  main.appendChild(sect);
  function loadSection (section: HTMLElement) {
    section.querySelectorAll("span.italic")
      .forEach(hideUndocumented);
    section.querySelectorAll(".docNodeKindIcon > div[title]")
      .forEach(setKind);
    const prepends = [];
    section.querySelectorAll("[data-kind=Namespace]")
      .forEach(el=>prepends.push(el));
    section.querySelectorAll('[data-kind="FunctionType Alias"]')
      .forEach(el=>prepends.push(el));
    prepends.reverse().forEach(el=>section.prepend(el));
    sect.appendChild(section);
  }
  function hideUndocumented (span: HTMLElement) {
    if (span.innerText === "No documentation available") {
      span.innerHTML = '&nbsp;';
    }
  }
  function setKind (icon: HTMLDivElement) {
    const kind = icon.title;
    const item = icon.parentElement.parentElement;
    const link = item.querySelector('a');
    item.dataset.kind ??= "";
    item.dataset.kind += kind;
    if (kind === 'Namespace') {
      const checkbox = Object.assign(document.createElement('input'), {
        type: 'checkbox',
        id: `ns-${link.title}`
      });
      link.prepend(checkbox);
    }
    if (link.title.includes('.')) {
      const [ns, _] = link.title.split('.');
      item.dataset.ns = ns;
    }
  }
}


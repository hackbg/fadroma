export default {
  lang:        'en-US',
  title:       'The Fadroma Guide',
  description: 'How to write Secret Network dApps with Fadroma',
  lastUpdated: true,
  themeConfig: {
    sidebar: [
      {
        text: "Welcome to Fadroma",
        collapsible: false,
        items: [
          { text: "Overview",          link: "/" },
          { text: "Project setup",     link: "/project-setup" },
          { text: "Contributing to Fadroma", link: "/contributing" },
        ]
      }, {
        text: "Rust",
        collapsible: false,
        items: [
          { text: "Prelude: Writing contracts",  link: "/prelude" },
          { text: "Derive: Advanced contracts",  link: "/derive" },
          { text: "Ensemble: Testing contracts", link: "/ensemble" },
        ]
      }, {
        text: "TypeScript",
        collapsible: false,
        items: [
          { text: "Client: Writing clients",      link: "/client" },
          { text: "Ops: Deploying and operating", link: "/ops" },
          { text: "Mocknet: Full-stack testing",  link: "/mocknet" },
        ]
      }
    ]
  }
}

export default Demo;
function Demo () {
}
namespace Demo {
  export function User (name: string) {
    return ['article.demouser',
      ['section.demometa', ['strong.demoname', name], ['strong', '1.00000000 tLBTC'], 'at tex1p9sv7g8tyljjymz4t6zyjpvepw4...'],
      ['div.demolog', 'Enter Bob, Carol.'],
      ['section.demoprogs',
        ['button.pill', 'Send'],
        ['button.pill', 'P2PK'],
        ['button.pill', 'Vault'],
        ['button.pill', 'Escrow'],
        ['input', { placeholder: 'chat' }],
        ['button.pill', 'Say']]]
  }
}

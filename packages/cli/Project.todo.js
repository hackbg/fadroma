import { writeFile, stat } from 'fs/promises';
import prompts from 'prompts';
import mkdirp from 'mkdirp';
const commands = {};
export default commands;
commands['init'] = async function init() {
    // ask project name
    const name = await prompts.prompts.text({
        message: 'Enter a project name (lowercase alphanumerics only)'
    });
    // check if directory exists
    try {
        const stats = await stat(name);
        if (stats.isFile()) {
            console.log(`\n  There's already a file called "${name}".`);
            console.log(`  Move it out of the way, or pick a different name.\n`);
            process.exit(1);
        }
        if (stats.isDirectory()) {
            console.log(`\n  There's already a directory called "${name}".`);
            console.log(`  Move it out of the way, or pick a different name.\n`);
            process.exit(1);
            // TODO ask to overwrite
        }
    }
    catch (e) {
        if (e.code !== 'ENOENT') {
            throw e;
        }
    }
    // create and enter project directory
    await mkdirp(name);
    process.chdir(name);
    await mkdirp("artifacts");
    await mkdirp("contracts");
    await mkdirp("contracts/hello");
    await mkdirp("contracts/hello/tests");
    await mkdirp("receipts");
    await mkdirp("scripts");
    await mkdirp("settings");
    // create project content
    await Promise.all([
        writeFile('.gitignore', '', 'utf8'),
        writeFile('Cargo.toml', '', 'utf8'),
        writeFile('README.md', '', 'utf8'),
        writeFile('package.json', '', 'utf8'),
        writeFile('pnpm-workspace.yaml', '', 'utf8'),
        writeFile('shell.nix', '', 'utf8'),
        writeFile('tsconfig.json', '', 'utf8'),
        writeFile('contracts/hello/Cargo.toml', '', 'utf8'),
        writeFile('contracts/hello/api.ts', '', 'utf8'),
        writeFile('contracts/hello/hello.rs', '', 'utf8'),
        writeFile('contracts/hello/package.json', '', 'utf8'),
        writeFile('contracts/hello/tests/mod.rs', '', 'utf8'),
        writeFile('scripts/Dev.ts.md', '', 'utf8'),
        writeFile('scripts/Ops.ts.md', '', 'utf8'),
    ]);
    console.log('\n  Project created.');
    // create /README.md
    // create /package.json
    // create /tsconfig.json
    // create /pnpm-workspace.yaml
    // create /shell.nix
    // create /scripts/Dev.ts.md
    // create /scripts/Ops.ts.md
    // create /Cargo.toml
    // create /contracts/hello/Cargo.toml
    // create /contracts/hello/package.json
    // create /contracts/hello/hello.rs
    // create /contracts/hello/api.ts
    // create /contracts/hello/tests/mod.ts
    // create /artifacts
    // create /receipts
    // run cargo build
    // git init
    // git commit
} `` `

## Entrypoint

` ``;
typescript;
import runCommands from '@hackbg/komandi';
import { fileURLToPath } from 'url';
if (fileURLToPath(import.meta.url) === process.argv[1]) {
    runCommands.default(commands, process.argv.slice(2));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUHJvamVjdC50b2RvLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiUHJvamVjdC50b2RvLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLE1BQU0sYUFBYSxDQUFBO0FBQzdDLE9BQU8sT0FBTyxNQUFNLFNBQVMsQ0FBQTtBQUM3QixPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUE7QUFDM0IsTUFBTSxRQUFRLEdBQUcsRUFBRSxDQUFBO0FBQ25CLGVBQWUsUUFBUSxDQUFBO0FBQ3ZCLFFBQVEsQ0FBQyxNQUFNLENBQUMsR0FBRyxLQUFLLFVBQVUsSUFBSTtJQUVwQyxtQkFBbUI7SUFDbkIsTUFBTSxJQUFJLEdBQUcsTUFBTSxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztRQUN0QyxPQUFPLEVBQUUscURBQXFEO0tBQy9ELENBQUMsQ0FBQTtJQUVGLDRCQUE0QjtJQUM1QixJQUFJO1FBQ0YsTUFBTSxLQUFLLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUE7UUFFOUIsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDbEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQ0FBc0MsSUFBSSxJQUFJLENBQUMsQ0FBQTtZQUMzRCxPQUFPLENBQUMsR0FBRyxDQUFDLHVEQUF1RCxDQUFDLENBQUE7WUFDcEUsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTtTQUNoQjtRQUVELElBQUksS0FBSyxDQUFDLFdBQVcsRUFBRSxFQUFFO1lBQ3ZCLE9BQU8sQ0FBQyxHQUFHLENBQUMsMkNBQTJDLElBQUksSUFBSSxDQUFDLENBQUE7WUFDaEUsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1REFBdUQsQ0FBQyxDQUFBO1lBQ3BFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUE7WUFDZix3QkFBd0I7U0FDekI7S0FDRjtJQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQ1YsSUFB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
import colors from 'colors/safe.js';
import { table, getBorderCharacters } from 'table';

const { bold } = colors;
const noBorders = {
  border: getBorderCharacters('void'),
  columnDefault: { paddingLeft: 0, paddingRight: 2 },
  drawHorizontalLine: () => false,
};

export async function runCommand(context, commands, commandToRun, ...args) {
  if (commandToRun) {
    let notFound = true;
    for (const command of commands.filter(Boolean)) {
      if (!command) continue;
      const [nameOrNames, info, fn, subcommands] = command;
      if (
        (typeof nameOrNames === 'string' && nameOrNames === commandToRun)
        || (nameOrNames instanceof Array && nameOrNames.indexOf(commandToRun) > -1)
      ) {
        notFound = false;
        let notImplemented = true;
        if (fn) {
          // allow subcommands to add to the context by returning an updated value
          // but preserve it if they return nothing (they can still mutate it)
          context = await Promise.resolve(fn(context, ...args)) || context;
          notImplemented = false;
        }
        if (subcommands && subcommands.length > 0) {
          context.command.push(args[0]);
          runCommand(context, subcommands, args[0], ...args.slice(1));
          notImplemented = false;
        }
        if (notImplemented) {
          console.warn(`${commandToRun}: not implemented`);
        }
      }
    }
    if (notFound) {
      console.warn(`${commandToRun}: no such command`);
    }
  } else {
    printUsage(context, commands);
  }
}

export function printUsage(context, commands) {
  const prefix = context.command.length > 0 ? ((context.command || []).join(' ')) : '';
  console.log(`\nsienna ${prefix}[COMMAND...]\n`);
  const tableData = collectUsage(context, commands);
  process.stdout.write(table(tableData, noBorders));
}

function collectUsage(context = {}, commands, tableData = [], visited = new Set(), depth = 0) {
  const maxDepth = -1; // increment to display command tree in depth
  const indent = Array(depth + 1).join('  ');
  for (const commandSpec of commands) {
    if (!commandSpec) {
      tableData.push(['', '', '']);
      continue;
    }
    let [command, docstring, fn, subcommands] = commandSpec; // eslint-disable-line
    if (visited.has(commandSpec)) {
      tableData.push([`  ${indent}${bold(command)}`, '(see above)', '']);
    } else {
      visited.add(commandSpec);
      if (command instanceof Array) command = command.join(', ');
      if (depth > maxDepth && subcommands && subcommands.length > 0) {
        tableData.push([`  ${indent}${bold(command)}`, docstring, bold(`(${subcommands.length} commands)`)]);
      } else {
        tableData.push([`  ${indent}${bold(command)}`, docstring, '']);
        if (subcommands) {
          collectUsage(context, subcommands, tableData, visited, depth + 1);
        }
      }
    }
  }
  return tableData;
}

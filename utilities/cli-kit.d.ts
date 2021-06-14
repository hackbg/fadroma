export interface CommandList extends Array<Command> {}
export type Command      = [CommandNames, CommandInfo, Function|null, CommandList]
export type CommandNames = CommandName|Array<CommandName>
export type CommandName  = string
export type CommandInfo  = string
export interface CommandContext {
  command?: Array<CommandName>
}

export async function runCommand (
  context:      CommandContext,
  commands:     CommandList,
  commandToRun: CommandName,
  ...args:      any
)

export async function printUsage (
  context:   CommandContext,
  commands:  CommandList,
)

function collectUsage (
  context:   CommandContext = {},
  commands:  CommandList,
  tableData: Array<[string, string]> = [],
  visited:   Set<Command> = new Set(),
  depth = 0
)

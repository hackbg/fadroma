export * from '@fadroma/ops';
export * from '@fadroma/scrt';
export * from '@fadroma/snip20';
import Scrt_1_2 from '@fadroma/scrt-1.2';
import { Console, print, bold, colors, timestamp, Chain, Deployments, FSUploader, CachingFSUploader, fileURLToPath } from '@fadroma/ops';
import runCommands from '@hackbg/komandi';
const console = Console('@fadroma/cli');
export class Fadroma {
    constructor() {
        // metastatic!
        this.Build = Fadroma.Build;
        this.Upload = Fadroma.Upload;
        this.Deploy = Fadroma.Deploy;
        this.chainId = process.env.FADROMA_CHAIN;
        /** Tree of command. */
        this.commands = {};
    }
    module(url) {
        // if main
        if (process.argv[1] === fileURLToPath(url)) {
            this.run(...process.argv.slice(2)); /*.then(()=>{
              console.info('All done.')
              process.exit(0)
            })*/
        }
        return this;
    }
    async run(...commands) {
        Error.stackTraceLimit = Math.max(1000, Error.stackTraceLimit);
        runCommands.default(this.commands, commands);
    }
    /** Establish correspondence between an input command
      * and a series of procedures to execute */
    command(name, ...steps) {
        const fragments = name.trim().split(' ');
        let commands = this.commands;
        for (let i = 0; i < fragments.length; i++) {
            commands[fragments[i]] = commands[fragments[i]] || {};
            if (i === fragments.length - 1) {
                commands[fragments[i]] = (...cmdArgs) => this.runCommand(name, steps, cmdArgs);
            }
            else {
                commands = commands[fragments[i]];
            }
        }
    }
    // Is this a monad?
    async runCommand(commandName, steps, cmdArgs) {
        requireChainId(this.chainId);
        const getChain = Chain.namedChains[this.chainId];
        const chain = await getChain();
        const agent = await chain.getAgent();
        await print.agentBalance(agent);
        let context = {
            cmdArgs,
            timestamp: timestamp(),
            chain,
            agent,
            uploadAgent: agent,
            deployAgent: agent,
            clientAgent: agent,
            suffix: `+${timestamp()}`,
            // Run a sub-procedure in the same context,
            // but without mutating the context.
            async run(procedure, args = {}) {
                console.info(bold('Running procedure:'), procedure.name || '(unnamed)', '{', Object.keys(args).join(' '), '}');
                const T0 = +new Date();
                let fail = false;
                try {
                    const result = await procedure({ ...context, ...args });
                    const T1 = +new Date();
                    return result;
                }
                catch (e) {
                    const T1 = +new Date();
                    throw e;
                }
            },
        };
        const T0 = +new Date();
        const stepTimings = [];
        // Composition of commands via steps:
        for (const step of steps) {
            if (!step) {
                console.warn(bold('Empty step in command'), commandName);
                continue;
            }
            const name = step.name;
            const T1 = +new Date();
            let updates;
            try {
                updates = await step({ ...context });
                // Every step refreshes the context
                // by adding its outputs to it.
                context = { ...context, ...updates };
                const T2 = +new Date();
                console.info('🟢 Deploy step', bold(name), colors.green('succeeded'), 'in', T2 - T1, 'msec');
                stepTimings.push([name, T2 - T1, false]);
            }
            catch (e) {
                const T2 = +new Date();
                console.error('🔴 Deploy step', bold(name), colors.red('failed'), 'in', T2 - T1, 'msec');
                stepTimings.push([name, T2 - T1, true]);
                console.error('Command', bold(name), colors.red('failed'), 'in', T2 - T0, 'msec');
                throw e;
            }
        }
        const T3 = +new Date();
        console.log();
        console.info(`The command`, bold(commandName), `took`, ((T3 - T0) / 1000).toFixed(1), `s 🟢`);
        for (const [name, duration, isError] of stepTimings) {
            console.info(' ', isError ? '🔴' : '🟢', bold((name || '(nameless step)').padEnd(40)), (duration / 1000).toFixed(1).padStart(10), 's');
        }
        return context;
    }
}
Fadroma.Build = {
    Scrt_1_2: {
        WithCache: Scrt_1_2.Builder.enable
    }
};
Fadroma.Upload = {
    FromFile: {
        WithCache: CachingFSUploader.enable,
        NoCache: FSUploader.enable
    }
};
Fadroma.Deploy = {
    New: Deployments.new,
    Append: Deployments.activate,
    Status: Deployments.status,
};
function requireChainId(id, chains = Chain.namedChains) {
    if (!id || !chains[id]) {
        console.error('Please set your FADROMA_CHAIN environment variable to one of the following:');
        for (const chain of Object.keys(chains).sort()) {
            console.log(`  ${chain}`);
        }
        // TODO if interactive, display a selector which exports it for the session
        process.exit(1);
    }
    return chains[id];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxjQUFjLGNBQWMsQ0FBQTtBQUM1QixjQUFjLGVBQWUsQ0FBQTtBQUM3QixjQUFjLGlCQUFpQixDQUFBO0FBQy9CLE9BQU8sUUFBUSxNQUFNLG1CQUFtQixDQUFBO0FBRXhDLE9BQU8sRUFDTCxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUN2QyxLQUFLLEVBQVMsV0FBVyxFQUN6QixVQUFVLEVBQUUsaUJBQWlCLEVBQzdCLGFBQWEsRUFDZCxNQUFNLGNBQWMsQ0FBQTtBQUVyQixPQUFPLFdBQVcsTUFBTSxpQkFBaUIsQ0FBQTtBQUV6QyxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUE7QUFNdkMsTUFBTSxPQUFPLE9BQU87SUFBcEI7UUFxQkUsY0FBYztRQUNkLFVBQUssR0FBSSxPQUFPLENBQUMsS0FBSyxDQUFBO1FBQ3RCLFdBQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFBO1FBQ3ZCLFdBQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFBO1FBa0J2QixZQUFPLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUE7UUFpQm5DLHVCQUF1QjtRQUN2QixhQUFRLEdBQWEsRUFBRSxDQUFBO0lBc0V6QixDQUFDO0lBeEdDLE1BQU0sQ0FBRSxHQUFXO1FBQ2pCLFVBQVU7UUFDVixJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssYUFBYSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQzFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUE7OztnQkFHOUI7U0FDTDtRQUNELE9BQU8sSUFBSSxDQUFBO0lBQ2IsQ0FBQztJQUVELEtBQUssQ0FBQyxHQUFHLENBQUUsR0FBRyxRQUFrQjtRQUM5QixLQUFLLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQTtRQUM3RCxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUE7SUFDOUMsQ0FBQztJQUlEO2dEQUM0QztJQUM1QyxPQUFPLENBQUUsSUFBWSxFQUFFLEdBQUcsS0FBcUI7UUFDN0MsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQTtRQUN4QyxJQUFJLFFBQVEsR0FBUSxJQUFJLENBQUMsUUFBUSxDQUFBO1FBQ2pDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3pDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFBO1lBQ3JELElBQUksQ0FBQyxLQUFLLFNBQVMsQ0FBQyxNQUFNLEdBQUMsQ0FBQyxFQUFFO2dCQUM1QixRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLE9BQWlCLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQTthQUN6RjtpQkFBTTtnQkFDTCxRQUFRLEdBQUcsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO2FBQ2xDO1NBQ0Y7SUFDSCxDQUFDO0lBS0QsbUJBQW1CO0lBQ1gsS0FBSyxDQUFDLFVBQVUsQ0FBRSxXQUFtQixFQUFFLEtBQXFCLEVBQUUsT0FBa0I7UUFDdEYsY0FBYyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQTtRQUM1QixNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQTtRQUNoRCxNQUFNLEtBQUssR0FBRyxNQUFNLFFBQVEsRUFBRSxDQUFBO1FBQzlCLE1BQU0sS0FBSyxHQUFHLE1BQU0sS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFBO1FBQ3BDLE1BQU0sS0FBSyxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQTtRQUMvQixJQUFJLE9BQU8sR0FBRztZQUNaLE9BQU87WUFDUCxTQUFTLEVBQUUsU0FBUyxFQUFFO1lBQ3RCLEtBQUs7WUFDTCxLQUFLO1lBQ0wsV0FBVyxFQUFFLEtBQUs7WUFDbEIsV0FBVyxFQUFFLEtBQUs7WUFDbEIsV0FBVyxFQUFFLEtBQUs7WUFDbEIsTUFBTSxFQUFFLElBQUksU0FBUyxFQUFFLEVBQUU7WUFDekIsMkNBQTJDO1lBQzNDLG9DQUFvQztZQUNwQyxLQUFLLENBQUMsR0FBRyxDQUFNLFNBQW1CLEVBQUUsT0FBNEIsRUFBRTtnQkFDaEUsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsRUFBRSxTQUFTLENBQUMsSUFBSSxJQUFFLFdBQVcsRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUE7Z0JBQzVHLE1BQU0sRUFBRSxHQUFHLENBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQTtnQkFDdkIsSUFBSSxJQUFJLEdBQUcsS0FBSyxDQUFBO2dCQUNoQixJQUFJO29CQUNGLE1BQU0sTUFBTSxHQUFHLE1BQU0sU0FBUyxDQUFDLEVBQUUsR0FBRyxPQUFPLEVBQUUsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFBO29CQUN2RCxNQUFNLEVBQUUsR0FBRyxDQUFFLElBQUksSUFBSSxFQUFFLENBQUE7b0JBQ3ZCLE9BQU8sTUFBTSxDQUFBO2lCQUNkO2dCQUFDLE9BQU8sQ0FBQyxFQUFFO29CQUNWLE1BQU0sRUFBRSxHQUFHLENBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQTtvQkFDdkIsTUFBTSxDQUFDLENBQUE7aUJBQ1I7WUFDSCxDQUFDO1NBQ0YsQ0FBQTtRQUNELE1BQU0sRUFBRSxHQUFHLENBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQTtRQUN2QixNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUE7UUFDdEIscUNBQXFDO1FBQ3JDLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO1lBQ3hCLElBQUksQ0FBQyxJQUFJLEVBQUU7Z0JBQ1QsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsRUFBRSxXQUFXLENBQUMsQ0FBQTtnQkFDeEQsU0FBUTthQUNUO1lBQ0QsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQTtZQUN0QixNQUFNLEVBQUUsR0FBRyxDQUFFLElBQUksSUFBSSxFQUFFLENBQUE7WUFDdkIsSUFBSSxPQUFPLENBQUE7WUFDWCxJQUFJO2dCQUNGLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxFQUFFLEdBQUcsT0FBTyxFQUFFLENBQUMsQ0FBQTtnQkFDcEMsbUNBQW1DO2dCQUNuQywrQkFBK0I7Z0JBQy9CLE9BQU8sR0FBRyxFQUFFLEdBQUcsT0FBTyxFQUFFLEdBQUcsT0FBTyxFQUFFLENBQUE7Z0JBQ3BDLE1BQU0sRUFBRSxHQUFHLENBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQTtnQkFDdkIsT0FBTyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxHQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQTtnQkFDMUYsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLEdBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUE7YUFDdkM7WUFBQyxPQUFPLENBQUMsRUFBRTtnQkFDVixNQUFNLEVBQUUsR0FBRyxDQUFFLElBQUksSUFBSSxFQUFFLENBQUE7Z0JBQ3ZCLE9BQU8sQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUUsR0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUE7Z0JBQ3RGLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxHQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFBO2dCQUNyQyxPQUFPLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxHQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQTtnQkFDL0UsTUFBTSxDQUFDLENBQUE7YUFDUjtTQUNGO1FBQ0QsTUFBTSxFQUFFLEdBQUcsQ0FBRSxJQUFJLElBQUksRUFBRSxDQUFBO1FBQ3ZCLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQTtRQUNiLE9BQU8sQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBQyxFQUFFLENBQUMsR0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUE7UUFDekYsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUMsSUFBSSxXQUFXLEVBQUU7WUFDbkQsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUMsT0FBTyxDQUFBLENBQUMsQ0FBQSxJQUFJLENBQUEsQ0FBQyxDQUFBLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLElBQUUsaUJBQWlCLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsR0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO1NBQzlIO1FBQ0QsT0FBTyxPQUFPLENBQUE7SUFDaEIsQ0FBQzs7QUE5SE0sYUFBSyxHQUFHO0lBQ2IsUUFBUSxFQUFFO1FBQ1IsU0FBUyxFQUFFLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTTtLQUNuQztDQUNGLENBQUE7QUFFTSxjQUFNLEdBQUc7SUFDZCxRQUFRLEVBQUU7UUFDUixTQUFTLEVBQUUsaUJBQWlCLENBQUMsTUFBTTtRQUNuQyxPQUFPLEVBQUksVUFBVSxDQUFDLE1BQU07S0FDN0I7Q0FDRixDQUFBO0FBRU0sY0FBTSxHQUFHO0lBQ2QsR0FBRyxFQUFLLFdBQVcsQ0FBQyxHQUFHO0lBQ3ZCLE1BQU0sRUFBRSxXQUFXLENBQUMsUUFBUTtJQUM1QixNQUFNLEVBQUUsV0FBVyxDQUFDLE1BQU07Q0FDM0IsQ0FBQTtBQWlISCxTQUFTLGNBQWMsQ0FBRSxFQUFFLEVBQUUsTUFBTSxHQUFHLEtBQUssQ0FBQyxXQUFXO0lBRXJELElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUU7UUFFdEIsT0FBTyxDQUFDLEtBQUssQ0FBQyw2RUFBNkUsQ0FBQyxDQUFBO1FBRTVGLEtBQUssTUFBTSxLQUFLLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUM5QyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssS0FBSyxFQUFFLENBQUMsQ0FBQTtTQUMxQjtRQUVELDJFQUEyRTtRQUMzRSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFBO0tBQ2hCO0lBRUQsT0FBTyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUE7QUFFbkIsQ0FBQyJ9
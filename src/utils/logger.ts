import chalk from "chalk";

export const logger = {
  info: (msg: string) => console.log(chalk.cyan("info"), msg),
  success: (msg: string) => console.log(chalk.green("done"), msg),
  warn: (msg: string) => console.log(chalk.yellow("warn"), msg),
  error: (msg: string) => console.error(chalk.red("fail"), msg),
  stage: (stage: string, msg: string) =>
    console.log(chalk.magenta(`[${stage}]`), msg),
};

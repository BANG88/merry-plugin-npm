import { Plugin, Action } from '@merryjs/cli/lib/plugin'
import path from 'path'
import { Question } from 'inquirer'
import { slugify, repoName as getRepoName } from './utils'
import { user } from './user'
import { install } from '@merryjs/cli/lib/npm'
import { Options } from 'prettier'
const superb = require('superb')
const normalizeUrl = require('normalize-url')
const humanizeUrl = require('humanize-url')
const _s = require('underscore.string')
const execa = require('execa')

/**
 * NpmAnswers
 */
export interface NpmAnswers {
  name: string
  moduleName: string
  moduleDescription: string
  githubUsername: string
  website: string
  [key: string]: any
}

export interface NpmOptions {
  coveralls?: boolean
  org?: string
  cli?: boolean
  coverage?: boolean
  install?: boolean
  [key: string]: any
}
export default (api: Plugin) => {
  api
    .command('npm <name>')
    .option('-o, --org [org]', 'Publish to a GitHub organization account')
    .option('-c, --cli', 'Add a CLI', false)
    .option(
      '-n, --no-install',
      'Do not automatically install dependencies',
      true
    )
    .option('-g, --coverage', 'Add code coverage with nyc', false)
    .option(
      '-l, --coveralls',
      'Upload coverage to coveralls.io (implies coverage',
      false
    )
    .action(async (name: string, options: NpmOptions) => {
      const questions: Question[] = [
        {
          name: 'moduleName',
          message: 'What do you want to name your module?',
          default: _s.slugify(name),
          filter: x => slugify(x),
        },
        {
          name: 'moduleDescription',
          message: 'What is your module description?',
          default: `My ${superb()} module`,
        },
        {
          name: 'githubUsername',
          message: 'What is your GitHub username?',
          validate: x =>
            x.length > 0 ? true : 'You have to provide a username',
          when: () => !options.org,
        },
        {
          name: 'website',
          message: 'What is the URL of your website?',
          validate: x =>
            x.length > 0 ? true : 'You have to provide a website URL',
          filter: x => normalizeUrl(x),
        },
        {
          name: 'cli',
          message: 'Do you need a CLI?',
          type: 'confirm',
          default: !!options.cli,
          when: () => options.cli === undefined,
        },
        {
          name: 'nyc',
          message: 'Do you need code coverage?',
          type: 'confirm',
          default: !!(options.coveralls || options.coverage),
          when: () =>
            options.coverage === undefined && options.coveralls === undefined,
        },
        {
          name: 'coveralls',
          message: 'Upload coverage to coveralls.io?',
          type: 'confirm',
          default: false,
          when: x =>
            (x.nyc || options.coverage) && options.coveralls === undefined,
        },
      ]
      // define your own questions or remove it if you don't need it
      const answers = await api.prompt<NpmAnswers>(questions)

      const or = (option: string, prop?: string) =>
        options[option] === undefined
          ? answers[prop || option]
          : options[option]

      const cli = or('cli')
      const coveralls = or('coveralls')
      const nyc = coveralls || or('coverage', 'nyc')

      const repoName = getRepoName(answers.moduleName)

      const tpl = {
        moduleName: answers.moduleName,
        moduleDescription: answers.moduleDescription,
        camelModuleName: _s.camelize(repoName),
        githubUsername: options.org || answers.githubUsername,
        repoName,
        name: user.git.name(),
        email: user.git.email(),
        website: answers.website,
        humanizedWebsite: humanizeUrl(answers.website),
        cli,
        nyc,
        coveralls,
      }

      const formatOpts: Options = {
        parser: 'typescript',
        singleQuote: true,
        semi: false,
        trailingComma: 'es5',
      }

      let actions: Action[] = [
        {
          path: '.prettierrc',
          templateFile: 'prettierrc',
        },
        {
          path: '.gitignore',
          templateFile: 'gitignore',
        },
        {
          path: '.travis.yml',
          templateFile: 'travis.yml',
        },
        {
          path: 'package.json',
          templateFile: '_package.json',
          format: {
            parser: 'json',
          },
        },
        {
          path: 'tsconfig.json',
          templateFile: '_tsconfig.json',
          format: {
            parser: 'json',
          },
        },
        {
          path: 'tslint.json',
          templateFile: 'tslint.json',
          format: {
            parser: 'json',
          },
        },
        {
          path: '.npmignore',
          templateFile: 'npmignore',
        },
        {
          path: 'index.ts',
          templateFile: 'index.ts',
          format: formatOpts,
        },
        {
          path: 'test.ts',
          templateFile: 'test.ts',
          format: formatOpts,
        },
        {
          path: 'license',
          templateFile: 'license',
        },
        {
          path: 'readme.md',
          templateFile: 'readme.md',
        },
      ]

      if (tpl.cli) {
        actions.push({
          path: 'cli.ts',
          templateFile: 'cli.ts',
          format: formatOpts,
        })
      }
      const cwd = path.join(process.cwd(), tpl.moduleName)
      actions = actions.map(action => {
        action.path = path.join(cwd, action.path)
        action.templateFile = './templates/' + action.templateFile
        return action
      })
      // run actions
      await api.runActions(actions, tpl)
      // init git repo
      try {
        await execa.shell('git init', {
          cwd,
        })
        api.log('created an empty git repo inside %s', cwd)
      } catch (error) {
        api.log(error)
      }
      // install dependencies
      if (options.install) {
        api.npm.install(cwd, '')
      }
    })
}

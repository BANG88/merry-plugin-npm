const _s = require('underscore.string');

const scopedRegex = /^(?:@([^/]+?)[/])([^/]+?)$/;

export const isScoped = (name: string) => scopedRegex.test(name);
export const repoName = (name: string) => isScoped(name) ? name.match(scopedRegex)![2] : name;
export const slugify = (name: string) => isScoped(name) ? name : _s.slugify(name);

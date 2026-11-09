export const skillCatalog: ReadonlyArray<readonly [string, RegExp, readonly string[]]>
export function detectSkills(value: string): { name: string; line: string; example: boolean }[]
export function mentionsSkill(name: string, value: string): boolean

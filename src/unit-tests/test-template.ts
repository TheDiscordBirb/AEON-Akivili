export interface TestTemplate {
    name: string,
    tests: {test: string, outcome: boolean}[]
}
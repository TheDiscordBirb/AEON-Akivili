class CommandTests {
    name = "Command Tests";
    tests : {test: string, outcome: boolean}[] = []

    runTests = async(): Promise<void> => {
        this.tests.push({test: "Default", outcome: true});
    }
}

export const commandTests = new CommandTests();
commandTests.runTests();
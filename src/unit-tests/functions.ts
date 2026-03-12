class FunctionTests {
    name = "Function Tests";
    tests : {test: string, outcome: boolean}[] = []

    runTests = async(): Promise<void> => {
        this.tests.push({test: "Default", outcome: true});
    }
}

export const functionTests = new FunctionTests();
functionTests.runTests();
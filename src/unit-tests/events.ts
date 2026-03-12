class EventTests {
    name = "Event Tests";
    tests : {test: string, outcome: boolean}[] = []

    runTests = async(): Promise<void> => {
        this.tests.push({test: "Default", outcome: true});
    }
}

export const eventTests = new EventTests();
eventTests.runTests();
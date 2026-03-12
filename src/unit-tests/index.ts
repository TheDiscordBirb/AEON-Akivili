import { commandTests } from "./commands";
import { eventTests } from "./events";
import { functionTests } from "./functions";
import { TestTemplate } from "./test-template";

class Tests {
    async run(testClusters: TestTemplate[]) {
        for await(const testCluster of testClusters) {
            console.log(`${testCluster.name}`);
            for await(const test of testCluster.tests) {
                console.log(`Test: ${test.test} Outcome: ${test.outcome ? "Passed" : "Failed"}`);
            };
            console.log("");
        };
    }
}

const tests = new Tests();
tests.run([
    {name: commandTests.name, tests: commandTests.tests},
    {name: eventTests.name, tests: eventTests.tests},
    {name: functionTests.name, tests: functionTests.tests}
]);
import { messageFilter } from "../functions/message-filter"

test("Test on clean message", async () => {
    await messageFilter.addToFilterArray([{word: "test"}]);
    expect(await messageFilter.filterMessage("This is clean")).toStrictEqual({resultClean: true});
});
test("Test on filtered message", async () => {
    expect(await messageFilter.filterMessage("This test is not clean")).toStrictEqual({
        resultClean: false, detectedFilteredContent: ["test"]
    });
});
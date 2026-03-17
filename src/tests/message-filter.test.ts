import { messageFilter } from "../functions/message-filter"

test("Message Filter mock", async () => {

    await messageFilter.addToFilterArray([{word: "test"}]);
    expect(await messageFilter.filterMessage("This is clean")).toStrictEqual({resultClean: true});
    expect(await messageFilter.filterMessage("This test is not clean")).toStrictEqual({
        resultClean: false, detectedFilteredContent: ["test"]
    });
});